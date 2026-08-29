<div align="center">

<img src="assets/icon.svg" width="88" height="88" alt="İndir Gitsin Logo" />

# İndir Gitsin

### YouTube & YouTube Music için en hızlı, en sade indirici

**Link yapıştır** veya **YouTube → Paylaş → İndir Gitsin** de, gerisini o halleder.

<br/>

[![Version](https://img.shields.io/badge/version-v1.4.0-FF0033?style=for-the-badge&labelColor=0a0a0f)](https://github.com/keremmkilincc-wq/indirgitsin/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/keremmkilincc-wq/indirgitsin/release.yml?branch=main&label=build&style=for-the-badge&labelColor=0a0a0f&color=7c3aed)](https://github.com/keremmkilincc-wq/indirgitsin/actions)
[![Downloads](https://img.shields.io/github/downloads/keremmkilincc-wq/indirgitsin/total?style=for-the-badge&labelColor=0a0a0f&color=06b6d4)](https://github.com/keremmkilincc-wq/indirgitsin/releases)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=for-the-badge&labelColor=0a0a0f)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android-3DDC84?style=for-the-badge&labelColor=0a0a0f&logo=android)](https://github.com/keremmkilincc-wq/indirgitsin/releases)

<br/>

[📥 APK İndir](https://github.com/keremmkilincc-wq/indirgitsin/releases/latest) • [🌐 Canlı Demo](#-hızlı-başlangıç) • [📖 Dokümantasyon](#-proje-yapısı) • [🐛 Hata Bildir](https://github.com/keremmkilincc-wq/indirgitsin/issues)

</div>

---

## ✨ Neden İndir Gitsin?

<table>
<tr>
<td width="50%">

**Tek dokunuşta** YouTube, YouTube Music, Shorts ve youtu.be linklerini çözümler. Sunucusuz doğrudan mod ile **MP4 / M4A doğrudan cihaza** iner, **MP3 cihazda FFmpeg.wasm ile** dönüştürülür. İstersen kendi backend’ini ekleyip 1080p+ ve birleştirme için kullanırsın.

</td>
<td width="50%">

```mermaid
flowchart LR
  A[YouTube Linki] --> B{Paylaş / Yapıştır}
  B --> C[ Piped + Innertube ]
  C --> D[ MP4 / M4A doğrudan ]
  C --> E[ MP3 cihazda dönüştür ]
  D --> F[Download/IndirGitsin]
  E --> F
```

</td>
</tr>
</table>

---

## 🎬 Ekran Görüntüleri

<div align="center">

| İndir Sekmesi | Geçmiş | Hakkında |
|---|---|---|
| Link yapıştır, kalite seç, indir | Grid, badge, oynat & sil | Glass hero, özellikler, güncelle |
| *Hero + Preview + Seçenekler* | *18 son işlem, zaman etiketi* | *v1.4.0, stats, repo linkleri* |

> **İpucu:** `assets/icon.svg` ve `manifest.json` ile tam PWA — ana ekrana ekle, uygulama gibi kullan.

</div>

---

## 🚀 Özellikler

| Özellik | Açıklama |
|---|---|
| 🔗 **Evrensel Link** | `youtube.com`, `youtu.be`, `music.youtube.com`, `m.youtube.com`, `Shorts` |
| 📤 **Paylaş → İndir Gitsin** | Android `SEND` + `VIEW` intent-filter, `MainActivity.java` native bridge |
| 🎬 **Video** | MP4 360p / 480p / 720p / 1080p (progressive doğrudan) |
| 🎵 **Ses** | M4A (128kbps), OPUS, **MP3 cihazda dönüştür** (FFmpeg.wasm 0.11 & 0.12 dual) |
| ⚡ **Sunucusuz** | Piped → Innertube fallback, `nativeFetch` + `CapacitorHttp` CORS bypass, `Filesystem.downloadFile` + `DownloadManager` |
| 🧩 **Sekmeli UI** | `İndir / Geçmiş / Hakkında` ayrı sekmeler, `bottom-nav` tab, akıcı `tabIn` animasyonu |
| 🕘 **Geçmiş** | Grid, format badge (video/cyan, audio/amber), `az önce / 3dk / dün`, oynat ▶ & sil ✕, 30 kayıt |
| ▶️ **Oynat** | Geçmişteki her videoyu/müziği taze URL ile `video`/`audio` modal’da oynat, YouTube’a git |
| 🔄 **Otomatik Güncelleme** | `api.github.com/releases/latest` 4 saatte bir, banner + `🔄` buton, `APK İndir` native bridge |
| 🎨 **Modern & Responsive** | Glassmorphism, gradient `Outfit` + `Inter`, dark/light persist, 980/768/640/380 breakpoint, compact |
| 🧪 **APK’sız Test** | `python -m http.server 8000` ile tarayıcıda birebir test |

---

## 🧠 Teknoloji

| Katman | Teknoloji | Neden bu? |
|---|---|---|
| **Frontend** | PWA `HTML/CSS/JS` + `Capacitor 6` | Tek kod tabanı, tarayıcıda test + native APK, WebView sarmalama |
| **Backend (opsiyonel)** | `Python FastAPI` + `yt-dlp` + `ffmpeg` | En stabil extractor, hem normal hem Music, MP3 birleştirme |
| **Android** | `Capacitor 6`, `DownloadManager`, `FileProvider` | Share Intent, `usesCleartextTraffic`, `file_paths.xml`, Play Store uyumlu |
| **MP3 Dönüşüm** | `FFmpeg.wasm` | Sunucu yoksa cihazda M4A→MP3, fallback `m4a as mp3` |
| **CI/CD** | `GitHub Actions` | `push main` / `tag v*` → `assembleDebug` + Release + artifact |

> **Alternatif:** Flutter değerlendirildi ama Windows’ta hızlı prototipleme ve APK’sız web test için PWA+Capacitor daha hafif ve hızlı.

---

## ⚡ Hızlı Başlangıç

### 1) Tarayıcıda (backend’siz, sunucusuz)

```bash
# klonla
git clone https://github.com/keremmkilincc-wq/indirgitsin.git
cd indirgitsin

# önizle
python -m http.server 8000
# → http://localhost:8000
# Örnek butonlarla dene, MP4/M4A doğrudan, MP3 cihazda dönüşür
```

### 2) Backend ile (gerçek, 1080p+ ve hızlı MP3)

```bash
pip install -r server/requirements.txt
# ffmpeg kurulu olmalı: https://ffmpeg.org
python server/app.py
# → http://localhost:8000
# ⚙️ Sunucu ayarı: http://192.168.1.15:8000 (ipconfig ile bul)
```

### 3) APK Kurulum (kullanıcı)

1. [Releases](https://github.com/keremmkilincc-wq/indirgitsin/releases/latest) → `app-debug.apk` indir
2. Android’de `Bilinmeyen kaynaklara izin ver` → kur
3. YouTube’da bir video → **Paylaş → İndir Gitsin** → kalite seç → `İndirilenler/IndirGitsin` klasöründe

---

## 📱 Android APK Oluşturma

### Lokal (Android Studio)

```bash
npm install
npx cap add android      # ilk kez
npx cap sync android
npx cap open android
# Android Studio → Build → Build APK(s)
```

Önemli dosyalar:
* `android/app/src/main/AndroidManifest.xml` → `SEND`/`VIEW` intent-filter + `usesCleartextTraffic`
* `android/app/src/main/res/xml/file_paths.xml` → `FileProvider` (yoksa build hatası)
* `.github/MainActivity.java` → `DownloadManager` + `window.Android.download(url, filename)` bridge + `handleIntent`

### Otomatik (GitHub Actions)

```bash
git tag v1.4.0
git push origin v1.4.0
# veya
git push origin main
```

`release.yml` adımları: `Prepare web assets (→ www/)` → `npm install` → `cap add/sync` → `Patch Manifest & MainActivity + file_paths.xml` → `gradlew assembleDebug` → artifact + Release.

Workflow badge’ini yukarıda görebilirsin. Her `main` push’u `v<run_number>` Release’i de oluşturur.

---

## 📂 Proje Yapısı

```
kozauygulama/
├─ index.html                 # Tabbed UI: indir / geçmiş / hakkında
├─ manifest.json              # PWA + share_target + shortcuts
├─ capacitor.config.json      # appId: com.indirgitsin.app, webDir: www
├─ package.json               # v1.4.0
├─ assets/
│  ├─ app.js                  # 1300+ satır: fetchInfo (Piped→Innertube), nativeFetch, downloadViaNative, ffmpeg dual, history, player, update
│  ├─ style.css               # Glassmorphism, responsive, tab, history grid, about hero
│  └─ icon.svg
├─ www/                       # Build çıktısı (index + assets kopyası, cap sync için)
├─ server/
│  ├─ app.py                  # FastAPI: /api/health, /api/info, /api/download
│  └─ requirements.txt
├─ android/                   # Capacitor android (gradlew, app/src/main/...)
│  ├─ app/src/main/AndroidManifest.xml
│  └─ app/src/main/res/xml/file_paths.xml
├─ .github/
│  ├─ workflows/release.yml
│  ├─ AndroidManifest.xml     # Template (CI’da kopyalanır)
│  └─ MainActivity.java       # Template (CI’da kopyalanır)
└─ README.md
```

---

## 🔌 API

| Endpoint | Açıklama |
|---|---|
| `GET /api/health` | `{"ok": true, "yt_dlp": true, "ffmpeg": true}` |
| `GET /api/info?url=...` | `{id, title, channel, duration, views, thumbnail, formats[]}` |
| `GET /api/download?url=...&format_id=...&ext=...` | Dosya stream (`Content-Disposition` ile) |

Frontend önce `Piped/Innertube` ile dener, backend sadece `hasServer=true` ise veya MP3 sunucu modunda kullanılır.

---

## 🎨 Arayüz Detayları

* **Sekmeler:** `bottom-nav` → `switchTab('indir'|'gecmis'|'hakkinda')`, `tabIn` keyframe, `window.scrollTo(0)`
* **Hero:** `badge` + `gradient-text` + `input-wrapper:focus-within` + `chips` yatay scroll
* **Preview/Options:** `filter-tabs` (Tümü/Video/Ses), `option` hover lift, `download-btn` gradient
* **Geçmiş:** `grid auto-fill 280px`, `history-badge`, `history-play` gradient, `history-delete` hover
* **Player Modal:** `playerModal` → `video`/`audio` toggle, `fetchInfo` taze URL, fallback YouTube link
* **About:** `about-hero` gradient + radial overlay, `about-features` 2×2 grid, `about-stats`

---

## ❓ SSS

**M4A/MP3 inmiyor?** GoogleVideo linkleri CORS’lu. `nativeFetch` + `CapacitorHttp` ve `Filesystem.downloadFile` ile bypass ediliyor. MP3 için `FFmpeg.wasm` 0.11/0.12 dual destek var, internet zayıfsa `m4a as mp3` fallback devreye girer.

**1080p neden yok?** Progressive MP4’ler genelde 720p’ye kadar. 1080p+ için backend’li `yt-dlp + ffmpeg` merge gerekir → `⚙️ Sunucu ayarı`.

**Nereye kaydediliyor?** `İndirilenler/IndirGitsin/<başlık>.<ext>` (native) veya tarayıcı `Downloads`.

**Sadece kendi videolarımı mı indirmeliyim?** Evet, yasal uyarıya uy: haklarına sahip olduğun veya izinli içerikler.

---

## 🤝 Katkı

```bash
git checkout -b feat/harika-ozellik
# değişiklik yap
git commit -m "feat: harika özellik"
git push origin feat/harika-ozellik
# PR aç → Actions APK’yi otomatik build eder
```

Issue açarken log’un `FAILURE: ...` kısmını ve `adb logcat` çıktısını ekle.

---

## 📄 Lisans

MIT © 2026 **İndir Gitsin** — Crafted with ❤️ by [@keremmkilincc-wq](https://github.com/keremmkilincc-wq)

<div align="center">

**[⬆ Başa Dön](#indir-gitsin)**

</div>
