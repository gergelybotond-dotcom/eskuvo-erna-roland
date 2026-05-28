# 🌍 Cloudflare Worker - Google Drive Upload API

Ez a Cloudflare Worker a wedding website backend-je. Kezeli a fájlfeltöltéseket, listázásokat és törléseket a Google Drive-nal.

## 📋 Fájlok

- `index.js` - A Worker main kódja
- `wrangler.toml` - Cloudflare Wrangler konfigurációs fájl
- `package.json` - NPM dependencies
- `DEPLOYMENT.md` - Részletes beállítási útmutató
- `TESTING.md` - Tesztelési útmutató és hibaelhárítás

## 🚀 Gyors Start

### 1. Telepítés

```bash
npm install -g wrangler
wrangler login
cd worker
wrangler publish --env production
```

### 2. Secrets beállítása

```bash
# Google Service Account JSON
wrangler secret put CF_SERVICE_KEY --env production

# Admin token (SHA-256 hash)
wrangler secret put ADMIN_TOKEN --env production
```

### 3. Tesztelés

```bash
curl https://eskuvo-upload.gergely-botond.workers.dev/files
```

## 📡 API Végpontok

### GET /files
Fájlok listázása a Google Drive mappáról.

**Válasz:**
```json
[
  {
    "id": "1A2B3C...",
    "name": "photo.jpg",
    "mimeType": "image/jpeg",
    "thumbnailLink": "https://...",
    "webContentLink": "https://..."
  }
]
```

### POST /upload
Fájl feltöltése a Google Drive-ra.

**Request:**
```
Content-Type: multipart/form-data
Body: file=<binary>
```

**Válasz:**
```json
{
  "success": true,
  "fileId": "1A2B3C...",
  "fileName": "photo.jpg"
}
```

**Támogatott fájltípusok:**
- `image/jpeg` (.jpg)
- `image/png` (.png)
- `video/mp4` (.mp4)

### DELETE /file/:id
Fájl törlése a Google Drive-ról.

**Header:**
```
Authorization: Bearer <ADMIN_TOKEN>
```

**Válasz:**
```json
{ "success": true }
```

## 🔐 Biztonsági Megjegyzések

- ✅ Privát kulcs **SOHA** nem kerül a repoba
- ✅ Environment variable-okban tárolódik
- ✅ Admin token SHA-256 hash
- ✅ CORS beállítva csak szükséges domainekhez módosítható

## 🛠️ Fejlesztés

### Development mód

```bash
wrangler dev
# Ekkor: http://localhost:8787
```

### Debugging

```bash
wrangler tail --env production
```

Ez megjeleníti az összes `console.log()` üzenetet.

## ⚙️ Konfigurációs Fájlok

### wrangler.toml

```toml
[env.production]
routes = [{ pattern = "eskuvo-upload.gergely-botond.workers.dev/*" }]
vars = { DRIVE_FOLDER_ID = "YOUR_FOLDER_ID" }
```

### Environment Variables

| Név | Típus | Erőforrás |
|-----|-------|----------|
| `CF_SERVICE_KEY` | Secret | Google Service Account JSON |
| `ADMIN_TOKEN` | Secret | SHA-256 hash |
| `DRIVE_FOLDER_ID` | Variable | wrangler.toml |

## 📚 További Dokumentáció

- **Beállítás**: Lásd [DEPLOYMENT.md](DEPLOYMENT.md)
- **Tesztelés**: Lásd [TESTING.md](TESTING.md)
- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **Google Drive API**: https://developers.google.com/drive/api

## 🔄 Telepítési Pipeline

```
Lokális módosítás
    ↓
wrangler publish --env production
    ↓
Cloudflare Worker frissül
    ↓
Az upload.html automatikusan új verzióhoz csatlakozik
```

## ❌ Szokásos Hibák

| Hiba | Ok | Megoldás |
|------|-----|----------|
| 404 | Rossz URL vagy path | Ellenőrizd a pathname-t |
| 500 + "service key" | CF_SERVICE_KEY nincs | `wrangler secret put CF_SERVICE_KEY` |
| CORS error | Preflight nem működik | OPTIONS handler működik, de teszteld a `wrangler dev`-vel |
| "Invalid JWT" | Service key rossz | Új Service Account-ot kellhet létrehozni |

---

**Utolsó frissítés**: 2026. május 28.
**Worker URL**: https://eskuvo-upload.gergely-botond.workers.dev
