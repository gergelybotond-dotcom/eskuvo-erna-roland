# ⚡ GYORS REFERENCIA - Worker Fix és Deploy

## 🎯 Mit Kellene Tenned

### 1️⃣ **Azonnal** (Most azonnal! 🔥)

```bash
cd d:\Informatika\ErnaRoland2026

# Fájlok frissítésének ellenőrzése
git status

# Módosítások hozzáadása és feltöltése
git add .
git commit -m "Fix: Worker 404 error, JWT parsing, error handling improvements"
git push
```

### 2️⃣ **Cloudflare Worker Deploy**

```bash
# Wrangler telepítése (ha nincs)
npm install -g wrangler

# Login
wrangler login

# Deploy production-be
cd worker
wrangler publish --env production
```

### 3️⃣ **Secrets Beállítása (Cloudflare Dashboard)**

**Opció A: CLI-vel (javasolt)**
```bash
# 1. Google Service Account JSON
wrangler secret put CF_SERVICE_KEY --env production
# Illeszd be a JSON teljes tartalmát, majd Ctrl+D

# 2. Admin token
wrangler secret put ADMIN_TOKEN --env production
# Illeszd be az admin jelszó SHA-256 hash-ét
```

**Opció B: Dashboard-ban**
1. https://dash.cloudflare.com/
2. **Workers & Pages** → **eskuvo-upload**
3. **Settings** → **Variables** (bal oldalt)
4. **Edit variables**
5. **+ Add variable**
   - **CF_SERVICE_KEY** (Encrypt: YES)
   - **ADMIN_TOKEN** (Encrypt: YES)

### 4️⃣ **Tesztelés**

```bash
# Loggok megtekintése (valós időben)
wrangler tail --env production

# MÁSIK TERMINALBAN: Teszt
curl https://eskuvo-upload.gergely-botond.workers.dev/files
```

**Várható válasz:**
- Üres array: `[]` ✅
- Hiba error key-vel: ✅ (de a kapcsolat működik)
- 404: ❌ (probléma!)

## 📋 Szükséges Adatok

| Adat | Hol van | Mit kell tenni |
|------|---------|---|
| **DRIVE_FOLDER_ID** | Esküvő mappa URL-je | Copy az ID-t a URL-ből |
| **ADMIN_PASSWORD** | Saját választás | Legyen egy erős jelszó |
| **Service Account JSON** | Google Cloud Console | Exportálj JSON-t |

### DRIVE_FOLDER_ID kinyerése

```
URL: https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J
ID:  1A2B3C4D5E6F7G8H9I0J  ← Ezt másold
```

### Admin jelszó SHA-256 hash-e

```bash
# Terminalban:
echo -n "jelszaved" | sha256sum

# Output: abc123def456...  ← Ezt másold
```

## 🚀 Deploy Sorrend

```
1. Git push ← Ehhez: GitHub Actions automatikusan deploy-ol
   ↓
2. wrangler publish --env production ← Worker frissítés
   ↓
3. wrangler secret put CF_SERVICE_KEY ← Secrets beállítása
   wrangler secret put ADMIN_TOKEN
   ↓
4. wrangler tail ← Tesztelés & debugging
   ↓
5. curl ... /files ← Végső teszt
```

## ✅ Sikeres Deploy Jelei

- ✅ `wrangler publish` befejezódött zöld üzenettel
- ✅ `wrangler tail` megjeleníti a logokat
- ✅ `curl .../files` válaszol (200-as vagy error, DE NEM 404)
- ✅ `upload.html` fájl feltöltésre használható

## ❌ Gyakori Hibák

| Hiba | Ok | Fix |
|------|---|-----|
| 404 Not Found | Routing probléma | Ellenőrizd a Worker kódot |
| "Service key" error | CF_SERVICE_KEY nincs | `wrangler secret put CF_SERVICE_KEY` |
| "No access token" | Google auth hiba | Ellenőrizd a JSON-t |
| CORS error | Preflight hiba | Tesztelj `wrangler dev`-vel |

## 🔍 Debugging

```bash
# 1. Logok megtekintése (élő)
wrangler tail --env production

# 2. Teszt kérés
curl -X GET https://eskuvo-upload.gergely-botond.workers.dev/files

# 3. Development mód
cd worker
wrangler dev
curl http://localhost:8787/files
```

## 📞 Gyors Segítség

1. **Elolvass**: [WORKER_FIXES.md](WORKER_FIXES.md) - Mi volt a hiba
2. **Szétd útmutató**: [worker/DEPLOYMENT.md](worker/DEPLOYMENT.md)
3. **Tesztelj**: [worker/TESTING.md](worker/TESTING.md)
4. **Debuggolj**: `wrangler tail --env production`

---

## 🎯 TL;DR (Nagyon Rövid Verzió)

```bash
# 1. Push to GitHub
cd d:\Informatika\ErnaRoland2026
git add .
git commit -m "Fix Worker issues"
git push

# 2. Deploy Worker
npm install -g wrangler
wrangler login
cd worker
wrangler publish --env production

# 3. Secrets beállítása
wrangler secret put CF_SERVICE_KEY --env production
wrangler secret put ADMIN_TOKEN --env production

# 4. Teszt
wrangler tail --env production
# másik terminalban:
curl https://eskuvo-upload.gergely-botond.workers.dev/files

# 5. Kész! 🎉
```

---

**Utolsó frissítés**: 2026. május 28.  
**Status**: 🟢 Production Ready  
**Dokumentáció**: Lásd a worker/ mappában
