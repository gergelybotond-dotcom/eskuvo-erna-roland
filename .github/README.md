# GitHub Actions Workflow

## Deploy.yml Leírása

A `.github/workflows/deploy.yml` automatikusan futtatódik, amikor a `main` branch-re push-olsz.

### Mit csinál?

1. **Kód checkout** - A repository tartalmát letölti
2. **Admin jelszó hash** - A `ADMIN_PASSWORD` secret-ből SHA-256 hash-t generál
3. **Config.js frissítés** - Behelyettesíti a placeholder értékeket:
   - `DRIVE_FOLDER_ID_PLACEHOLDER` → `${{ secrets.DRIVE_FOLDER_ID }}`
   - `ADMIN_HASH_PLACEHOLDER` → az előbb generált hash
4. **GitHub Pages upload** - Az összes fájlt feltölti
5. **Deploy** - Publikálja a website-ot

### Milyen Secretsre van szüksége?

1. `ADMIN_PASSWORD` - Az admin panel jelszava
2. `DRIVE_FOLDER_ID` - A Google Drive mappa ID-je

### Az Build Output

A workflow a teljes projektet (.gitignore-ot is beleértve) feltölti a GitHub Pages-re.

### Deployment Naplók

A GitHub Actions naplóit megtekintheted:
1. Repository → **Actions** tab
2. Válassz ki egy futást
3. **Nézd meg a lépéseket**

### Hibakeresés

Ha a workflow hibázik:
1. Ellenőrizd a Secrets-eket (Settings → Secrets)
2. Ellenőrizd, hogy a `config.js` szintaxisa helyes-e
3. Ellenőrizd a workflow YAML szintaxisát

### Manuális Trigger

Ha újra futtatni szeretnéd:
1. Repository → **Actions**
2. **Deploy to GitHub Pages** workflow
3. **Run workflow** gomb

---

**Tipp**: A workflow egyidejűleg csak egy futást engedélyez. Ha többször puszt egymás után, a korábbi futások törlődhetnek.
