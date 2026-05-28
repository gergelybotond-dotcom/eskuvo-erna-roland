# ✅ Worker Tesztelési Útmutató

Ha 404-et vagy más hibát kapsz, kövesd ezeket a teszteket lépésről lépésre.

## 1️⃣ Alapvető Connectivity Teszt

```bash
# Ellenőrizd, hogy az endpoint elérhető-e
curl -I https://eskuvo-upload.gergely-botond.workers.dev/files
```

Várható eredmény:
```
HTTP/2 500
access-control-allow-origin: *
```

(500-as is OK, ha van response - az nem 404-es)

## 2️⃣ CORS Teszt

```bash
# Preflight CORS kérés
curl -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  https://eskuvo-upload.gergely-botond.workers.dev/upload \
  -v
```

Várható headers:
```
access-control-allow-origin: *
access-control-allow-methods: GET, POST, DELETE, OPTIONS
access-control-allow-headers: Content-Type, Authorization
```

## 3️⃣ GET /files Teszt (nincs auth szükséges)

```bash
curl https://eskuvo-upload.gergely-botond.workers.dev/files
```

Ha van response, a kapcsolat működik. Hibázhatnak:
- `"error": "Server configuration error"` → CF_SERVICE_KEY probléma
- `"error": "No access token in response"` → Google autentikáció probléma
- Üres lista `[]` → OK! Nincs feltöltött fájl

## 4️⃣ POST /upload Teszt Dummy Fájllal

```bash
# Egy test.txt fájl létrehozása
echo "test content" > test.txt

# Upload teszt
curl -X POST \
  -F "file=@test.txt" \
  https://eskuvo-upload.gergely-botond.workers.dev/upload
```

**Megjegyzés**: JPG/PNG/MP4 kell az éles kódban, de a teszt hibákat is megjeleníti!

## 5️⃣ Browser DevTools Teszt

1. Nyisd meg az upload.html-t
2. F12 → Network tab
3. Válassz egy fájlt
4. Figyeld meg a network request-et

Az upload kérésnek így kellene kinéznie:
```
POST /upload HTTP/2
Host: eskuvo-upload.gergely-botond.workers.dev
Content-Type: multipart/form-data
```

Ha **404**-et kapsz:
- [ ] Az URL helyes-e? (`https://eskuvo-upload.gergely-botond.workers.dev/upload`)
- [ ] A pathname helyesen kerül feldolgozásra?
- [ ] Van-e CORS hiba a console-ban?

## 6️⃣ Cloudflare Logs Megtekintése

```bash
# Real-time logs
wrangler tail --env production
```

Ez megjeleníti az összes `console.log()` üzenetet a Worker-ből.

Keress ezekre a sorокra:
- `GET /files` vagy `POST /upload` - a request érkezik?
- `Uploading file:` - a feltöltés indult?
- `Token generation error:` - JWT/auth probléma?

## 7️⃣ Hardver-teszttől a prod-ig

### Fejlesztési mód

```bash
cd worker
wrangler dev
```

Ezután tesztelhetsz:
```bash
curl http://localhost:8787/files
curl -X POST -F "file=@test.jpg" http://localhost:8787/upload
```

### Production deploy

```bash
wrangler publish --env production
```

Ezután újra tesztelhetsz az éles URL-en.

## 8️⃣ Gyakori Hibák és Megoldások

### "404 Not Found"

```json
{ "error": "Not found", "path": "/upload", "method": "POST" }
```

**Megoldás:**
- Ellenőrizd, hogy a `pathname === '/upload'` egyezik-e
- Nézd meg a Worker kódban, a path feldolgozást
- Az URL-ben ne legyen többlet útvonal

### "Server configuration error"

```json
{ "error": "Server configuration error", "details": "Service key not configured" }
```

**Megoldás:**
- `CF_SERVICE_KEY` secret nincs beállítva
- Cloudflare Dashboard → Workers → Settings → Variables
- Vagy: `wrangler secret put CF_SERVICE_KEY --env production`

### "Failed to authenticate with Google"

```json
{ "error": "Failed to authenticate with Google", "details": "..." }
```

**Megoldás:**
- A Service Account JSON formátuma hibás
- Az private_key mező hiányzik vagy rossz
- Új Service Account-ot kellhet létrehozni

### Üres Array visszatérés `[]` a /files-ről

**Ez OK!** Azt jelenti:
- ✅ Az autentikáció működik
- ✅ A Google Drive API válaszol
- ✅ Csak még nincsenek feltöltött fájlok

### CORS hiba a böngészőben

```
Access to XMLHttpRequest blocked by CORS policy...
```

**Megoldás:**
- A headers már vannak a Worker-ben (`getCorsHeaders()`)
- A böngésző cache-t tisztítsd (Ctrl+Shift+Del)
- Nyisd meg privát ablakban
- Ellenőrizd, hogy OPTIONS preflight működik

## 9️⃣ Ha Még Nem Működik

### Ellenőrzési Checklist

- [ ] `wrangler publish --env production` futott? (nem dev!)
- [ ] `CF_SERVICE_KEY` beállítva? (secret)
- [ ] `ADMIN_TOKEN` beállítva? (secret)
- [ ] `DRIVE_FOLDER_ID` beállítva?
- [ ] A Google Drive mappa megosztva van-e a Service Account email-jével?
- [ ] A Service Account JSON jó-e?
- [ ] Van internet kapcsolatod?
- [ ] A Cloudflare account aktív?

### Debug Mód

1. Módosítsd a Worker-t, hogy több `console.log()`-ot adj hozzá:

```javascript
console.log(`Request received: ${request.method} ${pathname}`);
console.log(`Service key exists: ${!!serviceAccountKey}`);
console.log(`Folder ID: ${folderId}`);
```

2. `wrangler publish --env production`
3. `wrangler tail --env production`
4. Teszt request
5. Nézd meg a logger outputot

## 🆘 Utolsó Segítség

Ha semmis nem működik:

1. **Cloudflare Support**: https://support.cloudflare.com/
2. **Cloudflare Docs**: https://developers.cloudflare.com/workers/
3. **Google Cloud Docs**: https://cloud.google.com/drive/api/guides

---

**Tipp**: A `wrangler tail` a legjobb debugging tool! Ahhoz, hogy lásd az összes problémát, először futtasd azt, majd teszt request-et végezz, és figyeld a log outputot.
