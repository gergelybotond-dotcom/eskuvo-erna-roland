# 🚀 Cloudflare Worker Beállítási Útmutató

A Worker beállításához és telepítéséhez kövesd ezeket a lépéseket:

## 1. Cloudflare CLI telepítése

```bash
npm install -g wrangler
```

## 2. Cloudflare-hez bejelentkezés

```bash
wrangler login
```

Ez megnyit egy böngésző ablakot, ahol hitelesítheted magad.

## 3. Worker publikálása

### Elsőszörös publish

```bash
cd worker
wrangler publish
```

Ezt után a Worker elérhető lesz: `https://eskuvo-upload.gergely-botond.workers.dev`

### Production environment deploy

```bash
wrangler publish --env production
```

## 4. Secrets beállítása a Cloudflare Dashboard-ban

### Kétféle mód van:

#### Mód A: Cloudflare CLI-vel (javasolt)

```bash
# 1. Google Service Account JSON beállítása
wrangler secret put CF_SERVICE_KEY --env production

# Ez interaktívan kér egy multi-line inputot. Dolgozz így:
# - Nyisd meg a Google Service Account JSON fájlt
# - Másold be az egész tartalmat (Ctrl+A, Ctrl+C)
# - Illeszd be a terminalba (Ctrl+Shift+V)
# - Nyomj Ctrl+D (vagy a terminálodban a szokásos módszer) az entrada biztosítására

# 2. Admin token hash beállítása
wrangler secret put ADMIN_TOKEN --env production

# A SHA-256 hash az admin jelszóból:
# Valahogy így: abc123def456...
```

#### Mód B: Cloudflare Dashboard (ha CLI nem működik)

1. Cloudflare Dashboard → **Workers & Pages**
2. **eskuvo-upload** Worker kiválasztása
3. **Settings** → **Variables**
4. **Edit Variables** (bal oldalt)
5. **Add variable** gombra kattintás

**Hozzáadandó secretek:**

| Név | Típus | Érték |
|-----|-------|-------|
| `CF_SERVICE_KEY` | Secret (Encrypt) | A Google Service Account JSON teljes tartalma |
| `ADMIN_TOKEN` | Secret (Encrypt) | Az admin jelszó SHA-256 hash-je |

## 5. Nem-secret variables beállítása

A `DRIVE_FOLDER_ID` már van a `wrangler.toml`-ben, de ha módosítani szeretnéd:

### CLI-vel:

```bash
wrangler secret put DRIVE_FOLDER_ID --env production
```

### Dashboard-ban:

1. **Settings** → **Variables** (Environment variables)
2. **Edit variables**
3. Az **DRIVE_FOLDER_ID** módosítása

## 6. Tesztelés

### Development teszt

```bash
cd worker
wrangler dev
```

Ezt követően meglátod: `http://localhost:8787`

Tesztelhetsz curl-lel vagy fetch-sel:

```bash
# Fájlok listázása
curl https://localhost:8787/files

# Feltöltés teszt (szükséges Service Account)
curl -X POST -F "file=@test.jpg" https://localhost:8787/upload
```

### Production teszt

```bash
# GET /files
curl https://eskuvo-upload.gergely-botond.workers.dev/files

# Preflight CORS
curl -X OPTIONS -H "Origin: *" https://eskuvo-upload.gergely-botond.workers.dev/upload
```

## 7. Naplók megtekintése

### Cloudflare Dashboard

1. **Workers & Pages** → **eskuvo-upload**
2. **Logs** tab
3Aktív logok a deployment utolsó füsült

### CLI-vel

```bash
# Real-time logs
wrangler tail --env production

# Vagy development mód alatt a wrangler dev kimenete
```

## 8. Hibaelhárítás

### "Failed to parse service key" hiba

- Ellenőrizd, hogy a CF_SERVICE_KEY jó-e
- Az értéknek érvényes JSON-nak kell lennie
- Ügyelj az escape karakterekre (pl. `\"` helyett `"`)

### "No access token in response" hiba

- Ellenőrizd, hogy a Service Account email-je megosztott-e a Google Drive mappával
- Ellenőrizd, hogy a private_key helyes-e a JSON-ban

### 404 hiba az upload-nál

- Ellenőrizd, hogy a Worker URL helyes-e: `https://eskuvo-upload.gergely-botond.workers.dev/upload`
- Ellenőrizd a pathname-t a logokban
- Nézd meg a böngésző Network tab-ot (F12)

### CORS hiba

- Az összes végpontra van CORS header (`Access-Control-Allow-Origin: *`)
- Ellenőrizd a browser console-t (F12 → Console)

## 9. Environment Variables Összefoglalása

```yaml
Development (wrangler.toml):
  DRIVE_FOLDER_ID: "root"

Production (wrangler.toml + secrets):
  DRIVE_FOLDER_ID: "1CcpN3MUtGl6OS49gH7_9mE4nHn4vX1ea"
  CF_SERVICE_KEY: (secret - JSON)
  ADMIN_TOKEN: (secret - SHA-256 hash)
```

## 10. Deployment Checklist

- [ ] `npm install -g wrangler`
- [ ] `wrangler login`
- [ ] `wrangler publish --env production`
- [ ] `CF_SERVICE_KEY` secret beállítva
- [ ] `ADMIN_TOKEN` secret beállítva
- [ ] `DRIVE_FOLDER_ID` beállítva
- [ ] `wrangler tail --env production` működik
- [ ] `/files` GET teszt OK
- [ ] `/upload` POST teszt OK
- [ ] `/file/:id` DELETE teszt OK

---

**Tipp**: Az Environment variables változtatásakor nincs szükség újra publisholni. A Worker automatikusan újratöltődik az új értékekkel.

**Tipp 2**: Ha komolyabb hibával találkozol, a Cloudflare Support-ot vagy a Workers dokumentációt (https://developers.cloudflare.com/workers/) érdemes ellenőrizni.
