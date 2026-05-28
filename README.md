## Erna & Roland Esküvői Website

Statikus HTML/CSS/JS esküvői website GitHub Pages-en, Google Drive integrációval.

### 🚀 Projekt Struktúra

```
/
├── index.html                    # Főoldal
├── upload.html                   # Fájlfeltöltés
├── gallery.html                  # Galéria
├── admin.html                    # Admin panel (jelszóvédett)
├── style.css                     # Stílusok
├── config.js                     # Konfigurációs fájl
├── README.md                     # Ez a fájl
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Actions CI/CD
└── worker/
    └── index.js                  # Cloudflare Worker kód
```

### 🔧 Beállítás

#### 1. GitHub Secrets Konfigurálása

A GitHub repository Settings → Secrets and variables → Actions menüben adja hozzá:

- **ADMIN_PASSWORD**: Az admin panel jelszava (pl. `supertitkos123`)
- **DRIVE_FOLDER_ID**: Google Drive mappa ID, ahova a fájlok felkerülnek

#### 2. Google Cloud Beállítás

1. Google Cloud Console-ban hozzon létre egy Service Account-ot
2. JSON kulcsot exportáljon
3. A JSON tartalmat másolja a Cloudflare Worker CF_SERVICE_KEY environment variable-jébe

#### 3. Cloudflare Worker Telepítés

1. Wrangler telepítése: `npm install -g wrangler`
2. A projekt könyvtárba lépés: `cd worker`
3. `wrangler.toml` létrehozása (lásd lent)
4. Deploy: `wrangler publish`

#### Wrangler.toml Minta

```toml
name = "eskuvo-upload"
main = "index.js"
compatibility_date = "2024-01-01"

[env.production]
vars = { DRIVE_FOLDER_ID = "YOUR_FOLDER_ID" }
vars = { ADMIN_TOKEN = "SHA256_HASH_OF_PASSWORD" }

[[unsafe.binding]]
name = "CF_SERVICE_KEY"
type = "plain_text"
text = "YOUR_SERVICE_ACCOUNT_JSON"
```

#### 4. GitHub Pages Beállítás

1. Repository Settings → Pages
2. "GitHub Actions" deployment source kiválasztása
3. A workflow automatikusan futni fog a main branch push-ok után

### 📝 Oldalak

#### Főoldal (index.html)
- Elegáns, mobilra optimalizált design
- Fehér-arany színvilág
- Gombok: "Feltöltés" és "Galéria"

#### Feltöltés Oldal (upload.html)
- Drag & drop fájlfeltöltés
- JPG, PNG, MP4 támogatás
- Progress bar
- Sikeres feltöltés visszajelzése

#### Galéria Oldal (gallery.html)
- Masonry grid elrendezés
- Lightbox nézet kattintásra
- MP4 videók inline lejátszása
- Loading spinner

#### Admin Oldal (admin.html)
- SHA-256 jelszóvédelem
- Összes fájl listázása
- Törlés és letöltés lehetőség
- Képelőnézettel

### 🎨 Dizájn

- **Fonts**: Cormorant Garamond (display), Montserrat (body)
- **Elsődleges szín**: #C9A84C (arany)
- **Háttér**: #FFFFFF, #FAFAF8
- **Mobilra optimalizált**: 375px-1200px

### 🔐 Biztonsági Megjegyzések

- ✅ Admin jelszó SHA-256 hash-elve
- ✅ Privát kulcs SOHA nem kerül statikus fájlokba
- ✅ Authorization header szükséges a törléshez
- ✅ CORS beállítva az összes végpontra

### 🚀 Deploy

```bash
# 1. Repository feltöltése GitHub-ra
git add .
git commit -m "Initial commit"
git push -u origin main

# 2. GitHub Secrets beállítása (fent)

# 3. Cloudflare Worker deploy (opcionálisan)
cd worker
wrangler publish

# 4. GitHub Actions automatikusan deployol GitHub Pages-re
```

### 📱 Mobil Optimalizálás

- Responsive design 375px-től
- Touch-friendly gombok
- Masonry grid 2 oszlopon
- Optimalizált lightbox

### 🔗 URL-ek

- **Főoldal**: `https://[username].github.io/[repository]/`
- **Admin**: `https://[username].github.io/[repository]/admin.html`
- **Worker API**: `https://eskuvo-upload.gergely-botond.workers.dev`

### ✨ Fejlesztés

Helyi fejlesztéshez nyissa meg az index.html-t közvetlenül a böngészőben vagy használjon egy egyszerű HTTP szervert:

```bash
python -m http.server 8000
# vagy
npx http-server
```

### 📞 Támogatás

Hibák vagy kérdések esetén ellenőrizze:
1. A GitHub Actions workflow futási naplóját
2. A böngésző konzolját (F12)
3. A Cloudflare Worker Analytics oldalát

### 📄 Licenc

Privát használatra tervezve az esküvőre. Szabadon módosítható.
