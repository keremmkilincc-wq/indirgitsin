# İndir Gitsin — YouTube & YouTube Music İndirici

Modern, kullanıcı dostu YouTube indirme uygulaması. **Link yapıştır** veya **YouTube → Paylaş → İndir Gitsin** ile tek tıkla indir.

![İndir Gitsin](assets/icon.svg)

## Özellikler
- 🔗 **Link yapıştırınca çözümle**: YouTube, youtu.be, Music, Shorts, playlist
- 📤 **Share Intent**: YouTube / YouTube Music uygulamasından Paylaş deyince *İndir Gitsin* çıkar, link otomatik çözümlenir
- 🎬🎵 **Video & Ses**: MP4 (1080p/720p/360p), M4A, OPUS, MP3 (yt-dlp + ffmpeg ile dönüştürme)
- ✨ **Modern Arayüz**: Glassmorphism, gradient, dark mode, mobile-first, PWA
- 🧪 **APK olmadan test**: Tarayıcıdan direkt çalışır
- 🚀 **Otomatik Release**: `main`'e push → GitHub Actions APK build + Release oluşturur

## Teknoloji Seçimi
| Katman | Teknoloji | Neden |
|---|---|---|
| Frontend | **PWA (HTML/CSS/JS)** + Capacitor | APK olmadan tarayıcıda test, aynı kod ile native APK. Modern glass UI, tek kod tabanı |
| Backend | **Python FastAPI + yt-dlp** | En stabil YouTube extractor, hem normal hem Music destekler, ffmpeg ile MP3 dönüşümü |
| Android | **Capacitor 6** | Share Intent (SEND/VIEW) için native intent-filter, Play Store uyumlu, WebView ile PWA'yı sarmalar |
| CI/CD | **GitHub Actions** | Push → otomatik `assembleDebug` + Release + APK artifact |

> Alternatif Flutter düşünüldü; fakat Windows ortamında hızlı prototipleme ve APK olmadan web test gereksinimi için PWA+Capacitor daha hızlı ve hafif.

## Hızlı Başlangıç (APK olmadan test)

### 1) Tarayıcıda önizle (backend olmadan demo)
```bash
python -m http.server 8000
# http://localhost:8000 aç → örnek linklerle dene
# Demo modunda gerçek video yerine örnek dosya indirir
```

### 2) Gerçek indirme ile (backend'li)
```bash
pip install -r server/requirements.txt
python server/app.py
# http://localhost:8000 aç
# Gerçek YouTube linki yapıştır → kalite seç → indir
# Not: MP3 için sistemde ffmpeg kurulu olmalı (https://ffmpeg.org)
```

## Android APK Oluşturma

### Lokal (Android Studio)
```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
# Android Studio > Build > Build APK
```

Share Intent manifest'i: `android/app/src/main/AndroidManifest.xml` — `SEND` ve `VIEW` intent-filter'ları içerir.

### Otomatik (GitHub)
1. Repo'yu GitHub'a push et:
```bash
git init
git add .
git commit -m "feat: İndir Gitsin v1"
git branch -M main
git remote add origin https://github.com/KULLANICI/indir-gitsin.git
git push -u origin main
```
2. `Actions` sekmesinde workflow çalışır → APK artifact + Release oluşur.
3. Tag ile sürüm:
```bash
git tag v1.0.0
git push origin v1.0.0
```

## Proje Yapısı
```
kozauygulama/
├─ index.html              # PWA ana sayfa (modern UI)
├─ manifest.json           # PWA + share_target
├─ assets/
│  ├─ style.css            # Glassmorphism tema
│  ├─ app.js               # Link çözümleme, indirme, history, share handling
│  └─ icon.svg
├─ server/
│  ├─ app.py               # FastAPI + yt-dlp API (/api/info, /api/download)
│  └─ requirements.txt
├─ capacitor.config.json   # appId: com.indirgitsin.app
├─ package.json
├─ android/
│  ├─ app/src/main/AndroidManifest.xml  # Share Intent
│  └─ share-intent.js      # JS tarafı intent handler
└─ .github/workflows/release.yml  # Otomatik APK Release
```

## API
- `GET /api/health` → `{ok, yt_dlp}`
- `GET /api/info?url=...` → `{id, title, channel, duration, thumbnail, formats[]}`
- `GET /api/download?url=...&format_id=...&ext=...` → dosya stream

## Notlar
- YouTube Music linkleri (`music.youtube.com`) aynı extractor ile desteklenir.
- İndirilenler Android'de `Download/İndirGitsin` klasörüne kaydedilir (WebView download handler).
- Yasal uyarı: Yalnızca haklarına sahip olduğunuz veya Creative Commons içerikleri indirin.

## Lisans
MIT
