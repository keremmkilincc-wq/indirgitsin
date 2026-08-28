# Android Kurulumu (Paylaş → İndir Gitsin)

## 1) Capacitor projesi oluştur (ilk kez)
```bash
npm install
npx cap init "İndir Gitsin" com.indirgitsin.app --web-dir .
npx cap add android
```

## 2) Share Intent'i aktif et
`npx cap add android` sonrası oluşan `android/app/src/main/AndroidManifest.xml` dosyasını bu repodaki `android/app/src/main/AndroidManifest.xml` ile **birleştirin**. Özellikle `<intent-filter>` bloklarını koruyun:

- `android.intent.action.SEND` + `text/plain` → YouTube Paylaş menüsünde görünme
- `android.intent.action.VIEW` + youtube.com / youtu.be / music.youtube.com → linklere doğrudan tıklayınca açılma

## 3) Sync & Build
```bash
npx cap sync android
npx cap open android   # Android Studio açılır
```

Android Studio'da: `Build > Build APK` → APK `android/app/build/outputs/apk/debug/` içinde.

## 4) GitHub Actions otomatik APK
`main` branch'e push yapınca workflow otomatik:
- Capacitor sync
- Gradle ile APK build
- GitHub Release oluşturur + APK ekler

Detay: `.github/workflows/release.yml`

## 5) Share Intent test
- YouTube uygulamasında bir video aç → Paylaş → **İndir Gitsin** → uygulama linki otomatik çözümleyecek
- YouTube Music'te de aynı şekilde çalışır
