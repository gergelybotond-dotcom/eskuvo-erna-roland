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
 * Fájl feltöltése Cloudflare R2-re
 */
async function uploadToR2(file, fileName, r2Bucket) {
  if (!file || !fileName || !r2Bucket) {
    throw new Error('Missing required parameters for R2 upload');
  }

  try {
    // Fájl buffer-be olvasása
    const buffer = await file.arrayBuffer();
    
    console.log(`Uploading to R2: ${fileName} (${buffer.byteLength} bytes)`);

    // R2-re feltöltés
    await r2Bucket.put(fileName, buffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
      }
    });

    console.log(`✓ File uploaded to R2: ${fileName}`);
    return { id: fileName, name: fileName };

  } catch (error) {
    console.error(`✗ R2 upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Fájlok listázása az R2-ből
 */
async function listR2Files(r2Bucket) {
  if (!r2Bucket) {
    throw new Error('R2 bucket not available');
  }

  try {
    console.log(`Listing files from R2...`);

    // R2-ből listázás
    const result = await r2Bucket.list();
    
    // Objektumok JSON-ra konvertálása
    const files = result.objects.map(obj => ({
      id: obj.key,
      name: obj.key,
      size: obj.size,
      uploadedAt: obj.uploaded,
      contentType: obj.httpMetadata?.contentType || 'unknown'
    }));

    console.log(`Found ${files.length} files in R2`);
    return files;

  } catch (error) {
    console.error(`✗ R2 list failed: ${error.message}`);
    throw error;
  }
}

/**
 * Fájl törlése az R2-ből
 */
async function deleteFromR2(fileName, r2Bucket) {
  if (!fileName || !r2Bucket) {
    throw new Error('Missing file name or R2 bucket');
  }

  try {
    console.log(`Deleting from R2: ${fileName}`);

    await r2Bucket.delete(fileName);

    console.log(`✓ File deleted from R2: ${fileName}`);
    return true;

  } catch (error) {
    console.error(`✗ R2 delete failed: ${error.message}`);
    throw error;
  }
}

/**
 * POST /upload - Fájl feltöltése R2-re
 */
async function handleUpload(request, r2Bucket) {
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

    // R2-re feltöltés
    const result = await uploadToR2(file, file.name, r2Bucket);

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
 * GET /files - Fájlok listázása az R2-ből
 */
async function handleListFiles(r2Bucket) {
  try {
    const files = await listR2Files(r2Bucket);

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
 * DELETE /file/:id - Fájl törlése az R2-ből
 */
async function handleDeleteFile(request, fileId, r2Bucket, adminToken) {
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
    await deleteFromR2(fileId, r2Bucket);

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
 * Main Handler - R2 Storage
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
    console.log(`Available bindings: ${Object.keys(env).join(', ')}`);

    // R2 Bucket ellenőrzése
    const r2Bucket = env.R2_BUCKET;
    if (!r2Bucket) {
      console.error('✗ R2_BUCKET binding not found');
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: 'R2_BUCKET binding not configured'
        }),
        {
          status: 500,
          headers: getCorsHeaders()
        }
      );
    }

    console.log(`✓ R2 bucket available`);

    // Admin token
    const adminToken = env.ADMIN_TOKEN;
    console.log(`✓ Admin token configured: ${!!adminToken}`);

    // POST /upload - R2-re feltöltés
    if (request.method === 'POST' && pathname === '/upload') {
      return handleUpload(request, r2Bucket);
    }

    // GET /files - R2-ből listázás
    if (request.method === 'GET' && pathname === '/files') {
      return handleListFiles(r2Bucket);
    }

    // GET /download/:fileName - Fájl letöltése R2-ből
    const downloadMatch = pathname.match(/^\/download\/(.+)$/);
    if (request.method === 'GET' && downloadMatch) {
      const fileName = decodeURIComponent(downloadMatch[1]);
      try {
        const object = await r2Bucket.get(fileName);
        if (!object) {
          return new Response(
            JSON.stringify({ error: 'File not found' }),
            { status: 404, headers: getCorsHeaders() }
          );
        }
        return new Response(object.body, {
          status: 200,
          headers: {
            'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
            'Content-Length': object.size,
            'Cache-Control': 'public, max-age=31536000',
            ...getCorsHeaders()
          }
        });
      } catch (error) {
        console.error('Download error:', error);
        return new Response(
          JSON.stringify({ error: 'Download failed' }),
          { status: 500, headers: getCorsHeaders() }
        );
      }
    }

    // DELETE /file/:id - R2-ből törlés
    const deleteMatch = pathname.match(/^\/file\/(.+)$/);
    if (request.method === 'DELETE' && deleteMatch) {
      const fileId = decodeURIComponent(deleteMatch[1]);
      return handleDeleteFile(request, fileId, r2Bucket, adminToken);
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
