// Cloudflare Worker script a Google Drive integrációval

/**
 * CORS headers beállítása
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

/**
 * Preflight CORS kezelés
 */
function handleOptions() {
  return new Response('OK', {
    headers: getCorsHeaders()
  });
}

/**
 * JWT token generálás Google Drive API-hoz
 * RS256 algoritmussal (Web Crypto API)
 */
async function generateJWT(serviceAccountEmail, privateKey) {
  // Header
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  // Payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  // JWT encoding
  const headerEncoded = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payloadEncoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  // Privát kulcs importálása
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Aláírás létrehozása
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signatureInput)
  );

  const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${signatureInput}.${signatureEncoded}`;
}

/**
 * Google OAuth token lekérése
 */
async function getGoogleAccessToken(serviceAccountKey) {
  const privateKeyPEM = serviceAccountKey.private_key;
  
  // PEM formátum átalakítása
  const binaryString = atob(privateKeyPEM.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\n/g, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const jwt = await generateJWT(serviceAccountKey.client_email, bytes.buffer);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await response.json();
  return data.access_token;
}

/**
 * Fájl feltöltése Google Drive-ra
 */
async function uploadToGoogleDrive(file, fileName, accessToken, folderId) {
  const metadata = {
    name: fileName,
    parents: [folderId]
  };

  // Multipart form-data készítés
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Fájlok listázása a Google Drive mappáról
 */
async function listGoogleDriveFiles(accessToken, folderId) {
  const query = `'${folderId}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=id,name,mimeType,thumbnailLink,webContentLink&pageSize=1000`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`List failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Fájl törlése a Google Drive-ról
 */
async function deleteFromGoogleDrive(fileId, accessToken) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Delete failed: ${response.statusText}`);
  }

  return true;
}

/**
 * POST /upload - Fájl feltöltése
 */
async function handleUpload(request, serviceAccountKey, folderId) {
  const contentType = request.headers.get('content-type');
  
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Invalid content type' }), {
      status: 400,
      headers: getCorsHeaders()
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: getCorsHeaders()
      });
    }

    // Fájl típus validáció
    const validMimeTypes = ['image/jpeg', 'image/png', 'video/mp4'];
    if (!validMimeTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type' }), {
        status: 400,
        headers: getCorsHeaders()
      });
    }

    // Google token szerzése
    const accessToken = await getGoogleAccessToken(serviceAccountKey);

    // Feltöltés
    const result = await uploadToGoogleDrive(file, file.name, accessToken, folderId);

    return new Response(JSON.stringify({
      success: true,
      fileId: result.id,
      fileName: result.name
    }), {
      status: 200,
      headers: getCorsHeaders()
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: getCorsHeaders()
    });
  }
}

/**
 * GET /files - Fájlok listázása
 */
async function handleListFiles(serviceAccountKey, folderId) {
  try {
    const accessToken = await getGoogleAccessToken(serviceAccountKey);
    const files = await listGoogleDriveFiles(accessToken, folderId);

    return new Response(JSON.stringify(files), {
      status: 200,
      headers: getCorsHeaders()
    });
  } catch (error) {
    console.error('List error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: getCorsHeaders()
    });
  }
}

/**
 * DELETE /file/:id - Fájl törlése
 */
async function handleDeleteFile(request, fileId, serviceAccountKey, adminToken) {
  // Admin autentikáció
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: getCorsHeaders()
    });
  }

  const token = authHeader.slice(7);
  if (token !== adminToken) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: getCorsHeaders()
    });
  }

  try {
    const accessToken = await getGoogleAccessToken(serviceAccountKey);
    await deleteFromGoogleDrive(fileId, accessToken);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: getCorsHeaders()
    });
  } catch (error) {
    console.error('Delete error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: getCorsHeaders()
    });
  }
}

/**
 * Main Handler
 */
export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Service Account kulcs betöltése
    let serviceAccountKey;
    try {
      serviceAccountKey = JSON.parse(env.CF_SERVICE_KEY);
    } catch (error) {
      console.error('Failed to parse service key:', error);
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: getCorsHeaders()
      });
    }

    const folderId = env.DRIVE_FOLDER_ID || 'root';
    const adminToken = env.ADMIN_TOKEN;

    // URL feldolgozása
    const url = new URL(request.url);
    const pathname = url.pathname;

    // POST /upload
    if (request.method === 'POST' && pathname === '/upload') {
      return handleUpload(request, serviceAccountKey, folderId);
    }

    // GET /files
    if (request.method === 'GET' && pathname === '/files') {
      return handleListFiles(serviceAccountKey, folderId);
    }

    // DELETE /file/:id
    const deleteMatch = pathname.match(/^\/file\/(.+)$/);
    if (request.method === 'DELETE' && deleteMatch) {
      const fileId = deleteMatch[1];
      return handleDeleteFile(request, fileId, serviceAccountKey, adminToken);
    }

    // 404 Not Found
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: getCorsHeaders()
    });
  }
};
