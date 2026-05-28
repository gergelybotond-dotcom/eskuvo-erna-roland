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
 * Base64url encoding helper - TextEncoder + Web Crypto kompatibilis
 */
function base64urlEncode(data) {
  let bytes;
  
  // String vagy Uint8Array input kezelése
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    throw new Error('Invalid input type for base64urlEncode');
  }
  
  // Uint8Array -> string (btoa-hoz)
  let binaryString = '';
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  
  // Base64 encode és URL-safe karakter csere
  return btoa(binaryString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * JWT token generálás Google Drive API-hoz
 * RS256 algoritmussal (Web Crypto API)
 */
async function generateJWT(serviceAccountEmail, privateKeyBuffer) {
  console.log(`Generating JWT for: ${serviceAccountEmail}`);
  
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

  // JWT encoding TextEncoder-rel (Unicode-biztos)
  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  console.log(`JWT parts ready, signing...`);

  // Privát kulcs importálása - Web Crypto API
  let key;
  try {
    key = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer instanceof ArrayBuffer ? privateKeyBuffer : privateKeyBuffer.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    console.log(`✓ Private key imported`);
  } catch (error) {
    console.error(`✗ Failed to import private key: ${error.message}`);
    throw error;
  }

  // Aláírás létrehozása
  let signature;
  try {
    signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(signatureInput)
    );
    console.log(`✓ Signature created (${signature.byteLength} bytes)`);
  } catch (error) {
    console.error(`✗ Failed to sign: ${error.message}`);
    throw error;
  }

  // Aláírás base64url encoding
  const signatureEncoded = base64urlEncode(new Uint8Array(signature));

  const jwt = `${signatureInput}.${signatureEncoded}`;
  console.log(`✓ JWT generated successfully`);
  
  return jwt;
}

/**
 * Google OAuth token lekérése
 * PKCS8 ArrayBuffer importálás Web Crypto API-val
 */
async function getGoogleAccessToken(serviceAccountKey) {
  if (!serviceAccountKey || !serviceAccountKey.private_key) {
    throw new Error('Service account key missing or invalid');
  }

  const privateKeyPEM = serviceAccountKey.private_key;
  console.log(`Processing private key for: ${serviceAccountKey.client_email}`);

  try {
    // 1. PEM header/footer eltávolítása és newline normalizálása
    let privateKeyProcessed = privateKeyPEM
      .replace(/\\n/g, '\n')  // JSON-ban \n van, valódi newline kell
      .split('\n')
      .filter(line => line && !line.includes('PRIVATE KEY'))  // Header/footer törlése
      .join('');
    
    console.log(`✓ PEM cleaned (${privateKeyProcessed.length} chars)`);

    // 2. Base64 decode
    const binaryString = atob(privateKeyProcessed);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log(`✓ Base64 decoded (${bytes.byteLength} bytes)`);

    // 3. PKCS8 ArrayBuffer - ezt adjuk a generateJWT-nek
    const privateKeyBuffer = bytes.buffer;
    
    // JWT token generálása
    const jwt = await generateJWT(serviceAccountKey.client_email, privateKeyBuffer);

    // Google OAuth token kérése
    console.log(`Requesting Google access token...`);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error(`✗ Google token request failed: ${tokenResponse.status}`);
      console.error(`  Response: ${errorData.substring(0, 200)}`);
      throw new Error(`Failed to get access token (${tokenResponse.status}): ${errorData}`);
    }

    const data = await tokenResponse.json();
    
    if (!data.access_token) {
      console.error(`✗ No access token in response`);
      throw new Error('No access token in Google response');
    }

    console.log(`✓ Access token obtained (${data.access_token.substring(0, 20)}...)`);
    return data.access_token;

  } catch (error) {
    console.error(`✗ getGoogleAccessToken failed: ${error.message}`);
    throw error;
  }
}

/**
 * Fájl feltöltése Google Drive-ra
 */
async function uploadToGoogleDrive(file, fileName, accessToken, folderId) {
  if (!file || !fileName || !accessToken || !folderId) {
    throw new Error('Missing required parameters for upload');
  }

  // Multipart form-data assembly
  const metadata = {
    name: fileName,
    parents: [folderId]
  };

  // FormData konstruálása
  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append('file', file, fileName);

  // Google Drive API upload
  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Google Drive upload failed: ${uploadResponse.status} - ${errorText}`);
  }

  const uploadedFile = await uploadResponse.json();
  
  if (!uploadedFile.id) {
    throw new Error('Upload successful but no file ID returned');
  }

  return uploadedFile;
}

/**
 * Fájlok listázása a Google Drive mappáról
 */
async function listGoogleDriveFiles(accessToken, folderId) {
  if (!accessToken || !folderId) {
    throw new Error('Missing access token or folder ID');
  }

  // Query összeállítása - csak nem törölt fájlok a mappában
  const query = `'${folderId}' in parents and trashed=false`;
  const fieldsToFetch = 'id,name,mimeType,thumbnailLink,webContentLink';
  
  const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
  listUrl.searchParams.append('q', query);
  listUrl.searchParams.append('fields', `files(${fieldsToFetch})`);
  listUrl.searchParams.append('pageSize', '1000');

  console.log(`Listing files from folder: ${folderId}`);

  const listResponse = await fetch(listUrl.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    throw new Error(`List failed (${listResponse.status}): ${errorText}`);
  }

  const data = await listResponse.json();
  
  if (!data.files) {
    console.warn('No files field in response');
    return [];
  }

  console.log(`Found ${data.files.length} files`);
  return data.files;
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
  try {
    // FormData feldolgozása
    let formData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error('FormData parsing error:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid form data', details: error.message }),
        {
          status: 400,
          headers: getCorsHeaders()
        }
      );
    }

    const file = formData.get('file');

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        {
          status: 400,
          headers: getCorsHeaders()
        }
      );
    }

    // Fájl típus validáció
    const validMimeTypes = ['image/jpeg', 'image/png', 'video/mp4'];
    if (!validMimeTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid file type',
          received: file.type,
          allowed: validMimeTypes
        }),
        {
          status: 400,
          headers: getCorsHeaders()
        }
      );
    }

    console.log(`Uploading file: ${file.name} (${file.type}, ${file.size} bytes)`);

    // Google Access Token szerzése
    let accessToken;
    try {
      accessToken = await getGoogleAccessToken(serviceAccountKey);
    } catch (error) {
      console.error('Token generation error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to authenticate with Google',
          details: error.message
        }),
        {
          status: 500,
          headers: getCorsHeaders()
        }
      );
    }

    // Feltöltés Google Drive-ra
    const result = await uploadToGoogleDrive(file, file.name, accessToken, folderId);

    console.log(`File uploaded successfully: ${result.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileId: result.id,
        fileName: result.name
      }),
      {
        status: 200,
        headers: getCorsHeaders()
      }
    );
  } catch (error) {
    console.error('Upload handler error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Upload failed',
        details: error.message
      }),
      {
        status: 500,
        headers: getCorsHeaders()
      }
    );
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
    // CORS preflight kezelés
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // URL feldolgozása
    const url = new URL(request.url);
    const pathname = url.pathname;

    console.log(`${request.method} ${pathname}`);
    
    // Debug: Environment variables teljes listája
    const allEnvKeys = Object.keys(env);
    console.log(`Available env keys: ${allEnvKeys.join(', ')}`);

    // Service Account kulcs betöltése az environment-ből
    let serviceAccountKey;
    try {
      // Közvetlenül az env-ből olvassuk a CF_SERVICE_KEY secret-et
      const serviceKeyStr = env.CF_SERVICE_KEY;
      
      console.log(`✓ Attempting to read CF_SERVICE_KEY`);
      console.log(`  - Exists: ${serviceKeyStr !== undefined && serviceKeyStr !== null}`);
      console.log(`  - Is string: ${typeof serviceKeyStr === 'string'}`);
      console.log(`  - Length: ${serviceKeyStr ? serviceKeyStr.length : 0}`);
      
      if (!serviceKeyStr) {
        console.error('✗ CF_SERVICE_KEY is missing or empty');
        console.error(`  - Available keys: ${allEnvKeys.join(', ')}`);
        return new Response(
          JSON.stringify({ 
            error: 'Server configuration error',
            details: 'CF_SERVICE_KEY secret not found',
            availableKeys: allEnvKeys,
            tip: 'Ensure CF_SERVICE_KEY is set in Cloudflare Dashboard'
          }),
          {
            status: 500,
            headers: getCorsHeaders()
          }
        );
      }

      // JSON parse - a secret-ből közvetlenül JSON string jön
      try {
        serviceAccountKey = JSON.parse(serviceKeyStr);
        console.log(`✓ CF_SERVICE_KEY parsed successfully`);
        console.log(`  - Client email: ${serviceAccountKey.client_email}`);
      } catch (parseError) {
        console.error(`✗ Failed to parse CF_SERVICE_KEY as JSON`);
        console.error(`  - Error: ${parseError.message}`);
        console.error(`  - First 100 chars: ${serviceKeyStr.substring(0, 100)}...`);
        throw new Error(`Invalid JSON in CF_SERVICE_KEY: ${parseError.message}`);
      }

    } catch (error) {
      console.error('✗ Service key initialization failed:', error.message);
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: error.message
        }),
        {
          status: 500,
          headers: getCorsHeaders()
        }
      );
    }

    // Environment variables értékei
    const folderId = env.DRIVE_FOLDER_ID || 'root';
    const adminToken = env.ADMIN_TOKEN;

    console.log(`✓ Configuration loaded`);
    console.log(`  - Folder: ${folderId}`);
    console.log(`  - Admin token exists: ${!!adminToken}`);

    // POST /upload - Fájl feltöltése
    if (request.method === 'POST' && pathname === '/upload') {
      return handleUpload(request, serviceAccountKey, folderId);
    }

    // GET /files - Fájlok listázása
    if (request.method === 'GET' && pathname === '/files') {
      return handleListFiles(serviceAccountKey, folderId);
    }

    // DELETE /file/:id - Fájl törlése
    const deleteMatch = pathname.match(/^\/file\/(.+)$/);
    if (request.method === 'DELETE' && deleteMatch) {
      const fileId = decodeURIComponent(deleteMatch[1]);
      return handleDeleteFile(request, fileId, serviceAccountKey, adminToken);
    }

    // 404 - Ismeretlen végpont
    return new Response(
      JSON.stringify({ 
        error: 'Not found',
        path: pathname,
        method: request.method
      }),
      {
        status: 404,
        headers: getCorsHeaders()
      }
    );
  }
};
