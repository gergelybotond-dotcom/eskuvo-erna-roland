# 🔧 Teljes Beállítási Útmutató

Ez az útmutató lépésről lépésre végigvezet a wedding website teljes beállításán.

## 1️⃣ Első lépések: Google Cloud Setup

### 1.1 Google Cloud Project Létrehozása

1. Lépj a [Google Cloud Console](https://console.cloud.google.com/) oldalra
2. Új projekt létrehozása: **Create Project**
3. Név: `EsküvőWebsite`
4. **Create** gomb

### 1.2 Google Drive API Engedélyezése

1. A projekt kiválasztása
2. **APIs & Services** → **Library**
3. "Google Drive API" keresése
4. **Enable** kattintás
5. **Create Credentials** gomb

### 1.3 Service Account Létrehozása

1. **Credentials** menüpont
2. **Create Credentials** → **Service Account**
3. Adatok kitöltése:
   - Service account name: `eskuvo-bot`
   - Email automatikus
4. **Create and Continue**
5. **Grant this service account access to project** → kihagyható → **Continue**
6. **Create Key** → JSON formátum
7. A JSON fájl automatikusan letölt

### 1.4 Google Drive Mappa Megosztása

1. Hozz létre egy mappát a Google Drive-on: `Esküvő 2026`
2. Jobb klikk → **Share**
3. A Service Account email-jét illeszd be (a JSON-ben az "client_email")
4. **Editor** jogok
5. **Share**

## 2️⃣ GitHub Repository Setup

### 2.1 Repository Létrehozása

1. [GitHub.com](https://github.com) → **New repository**
2. Név: `wedding-website` vagy hasonló
3. **Public** (a GitHub Pages szükségli)
4. **Create repository**

### 2.2 Projekt Feltöltése

```bash
# Könyvtárba lépés
cd d:\Informatika\ErnaRoland2026

# Git inicializálása
git init
git add .
git commit -m "Initial wedding website commit"
git branch -M main

# Remote hozzáadása (cseréld le a USERNAME-et és REPO-t)
git remote add origin https://github.com/USERNAME/REPO.git

# Feltöltés
git push -u origin main
```

### 2.3 GitHub Secrets Beállítása

1. A repository-ban: **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**

Három secret szükséges:

#### Secret 1: ADMIN_PASSWORD
- **Name**: `ADMIN_PASSWORD`
- **Value**: Az admin panel jelszava (pl. `SuperTitkos2026!`)
- **Add secret**

#### Secret 2: DRIVE_FOLDER_ID
- Az esküvő mappájának ID-jét kell megtalálni
- A Google Drive mappán: jobb klikk → nyisd meg az URL-t
- Az URL így néz ki: `https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J`
- Az ID: `1A2B3C4D5E6F7G8H9I0J`
- **Name**: `DRIVE_FOLDER_ID`
- **Value**: (az ID)
- **Add secret**

#### Secret 3: CF_SERVICE_KEY
- **Name**: `CF_SERVICE_KEY`
- **Value**: A teljes Google Service Account JSON (a JSON file teljes tartalma)
- **Add secret**

### 2.4 GitHub Pages Engedélyezése

1. **Settings** → **Pages**
2. **Source**: "GitHub Actions" választása
3. Ez szükséges ahhoz, hogy az Actions workflow deployoljon

## 3️⃣ Cloudflare Worker Setup

### 3.1 Cloudflare Fiók

1. Ha nincs Cloudflare fiók, regisztrálj a [Cloudflare.com](https://cloudflare.com) oldalon
2. **Workers** menüpont

### 3.2 Worker Projekt Telepítés

```bash
# npm telepítése (ha nincs)
# https://nodejs.org/

# Wrangler telepítése
npm install -g wrangler

# Cloudflare-hez login
wrangler login

# Worker könyvtárba lépés
cd worker

# Projekt inicializálása (opcionális, már van wrangler.toml)
wrangler init
```

### 3.3 Worker Deploy

```bash
# Development teszt
wrangler dev

# Production deploy
wrangler publish
```

### 3.4 Worker Environment Változók Beállítása

1. Cloudflare Dashboard → **Workers** → **eskuvo-upload**
2. **Settings** → **Environment variables**
3. Három variable hozzáadása:

#### Variable 1: DRIVE_FOLDER_ID
- **Name**: `DRIVE_FOLDER_ID`
- **Value**: Az esküvő Drive mappa ID-je
- **Encrypt**: Nem kell

#### Variable 2: ADMIN_TOKEN
- **Name**: `ADMIN_TOKEN`
- **Value**: Az admin jelszó SHA-256 hash-je
  - Online tool: https://www.sha256.online/
  - Vagy: `echo -n "password" | sha256sum`
- **Encrypt**: Igen

#### Variable 3: CF_SERVICE_KEY (SECRET)
- **Name**: `CF_SERVICE_KEY`
- **Value**: A teljes Google Service Account JSON
- **Encrypt**: Igen (obvinként!)

## 4️⃣ Config.js Frissítése

Az index.html, upload.html, stb. fájlokban már van egy dinamikus config, de a GitHub Actions workflow automatikusan kitölt mindent.

Ha manuálisan szeretnél tesztelni, akkor:

1. `config.js` megnyitása
2. `DRIVE_FOLDER_ID_PLACEHOLDER` helyére: az esküvő mappa ID-je
3. `ADMIN_HASH_PLACEHOLDER` helyére: az admin jelszó SHA-256 hash-je

Például:
```javascript
const CONFIG = {
  WORKER_URL: "https://eskuvo-upload.gergely-botond.workers.dev",
  DRIVE_FOLDER_ID: "1A2B3C4D5E6F7G8H9I0J",
  ADMIN_PASSWORD_HASH: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
};
```

## 5️⃣ Tesztelés

### 5.1 GitHub Pages Teszt

1. Miután pusht végzel, GitHub Actions automatikusan fut
2. A repository → **Actions** alatt látod a workflow-t
3. Várj, amíg befejez (zöld ✓)
4. A website elérhető lesz: `https://USERNAME.github.io/REPO-NAME/`

### 5.2 Feltöltés Teszt

1. Nyisd meg az upload.html-t
2. Válassz egy JPG/PNG/MP4 fájlt
3. A fájl feltöltésre kerül a Google Drive-ra

### 5.3 Galéria Teszt

1. Nyisd meg a gallery.html-t
2. Az összes feltöltött fájl megjelenik
3. Kattintás → lightbox nézet

### 5.4 Admin Panel Teszt

1. Nyisd meg az admin.html-t
2. Az admin jelszót add meg
3. Az összes fájl listázódik törlés/letöltés lehetőséggel

## 6️⃣ Hibaelhárítás

### A website nem jelenik meg
- Ellenőrizd, hogy a GitHub Actions workflow sikeresen futott-e (Actions tab)
- Ellenőrizd a Pages beállításokat (Settings → Pages)
- Nincs cache? Nyisd meg privát ablakban

### A feltöltés nem működik
- Ellenőrizd a böngésző konzolját (F12 → Console)
- Ellenőrizd a Worker naplóit: Cloudflare Dashboard → Workers → Logs
- Ellenőrizd, hogy a CF_SERVICE_KEY helyes-e

### Az admin jelszó nem működik
- Ellenőrizd a hash-t: SHA-256 hash az admin jelszóból
- A böngésző konzolán nézd meg: `await sha256("jelszó")`
- Egyezik-e a config.js-ben szereplő hash-sel?

### A Google Drive feltöltés hibázik
- Ellenőrizd, hogy a Service Account email-je megosztva van-e a mappával
- Ellenőrizd a CF_SERVICE_KEY értékét (helyes JSON?)
- Ellenőrizd a DRIVE_FOLDER_ID értékét

## 7️⃣ Üzemeltetés Tippek

### Rendszeres Karbantartás
- Időről időre törölj régi fájlokat az admin panelről
- Ellenőrizd a Google Drive szabad helyét

### Biztonsági Javaslatok
- Az admin jelszót változtasd meg rendszeresen
- A Service Account JSON-t bizalmasan kezelni!
- Csak megbízható embereknek add meg az admin jelszót

### Fejlesztéshez
```bash
# Helyi teszt
python -m http.server 8000
# Nyisd meg: http://localhost:8000
```

## ✅ Csekklista

- [ ] Google Cloud Service Account létrehozva
- [ ] Google Drive mappa megosztva
- [ ] GitHub repository feltöltve
- [ ] Mindhárom GitHub Secret beállítva
- [ ] GitHub Pages Pages engedélyezve
- [ ] Cloudflare Worker deployálva
- [ ] Worker environment változók beállítva
- [ ] GitHub Actions workflow futott (zöld ✓)
- [ ] Website elérhető a GitHub Pages URL-en
- [ ] Feltöltés teszt: OK
- [ ] Galéria teszt: OK
- [ ] Admin panel teszt: OK

---

**Gratulálunk! Az esküvői website kész és működőképes! 🎉**
