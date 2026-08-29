#!/usr/bin/env node
// Bump version everywhere: package.json, assets/app.js, index.html, README.md
// Usage: node scripts/bump-version.js 1.5.0
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const newVer = process.argv[2] || require(path.join(root, 'package.json')).version;

if (!/^\d+\.\d+\.\d+$/.test(newVer)) {
  console.error('Usage: node scripts/bump-version.js 1.5.0');
  process.exit(1);
}

function replaceFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  for (const [pattern, replacer] of replacements) {
    content = content.replace(pattern, replacer);
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✔ ${path.relative(root, filePath)}`);
  } else {
    console.log(`· ${path.relative(root, filePath)} (no change)`);
  }
}

// 1) package.json
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = newVer;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`✔ package.json → ${newVer}`);

// 2) assets/app.js -> const APP_VERSION = 'x'
replaceFile(path.join(root, 'assets/app.js'), [
  [/const APP_VERSION = '[^']*'/g, `const APP_VERSION = '${newVer}'`],
]);

// 3) www/assets/app.js (mirror)
if (fs.existsSync(path.join(root, 'www/assets/app.js'))) {
  replaceFile(path.join(root, 'www/assets/app.js'), [
    [/const APP_VERSION = '[^']*'/g, `const APP_VERSION = '${newVer}'`],
  ]);
}

// 4) index.html -> v1.x.x badges (two places)
replaceFile(path.join(root, 'index.html'), [
  [/v\d+\.\d+\.\d+ • 2026/g, `v${newVer} • 2026`],
]);
if (fs.existsSync(path.join(root, 'www/index.html'))) {
  replaceFile(path.join(root, 'www/index.html'), [
    [/v\d+\.\d+\.\d+ • 2026/g, `v${newVer} • 2026`],
  ]);
}

// 5) README.md -> badge + any v references, keep logo as assets/icon.svg
replaceFile(path.join(root, 'README.md'), [
  // shield badge version-v1.4.0- -> version-v1.5.0-
  [/version-v\d+\.\d+\.\d+-/g, `version-v${newVer}-`],
  // any inline v1.4.0 -> v1.5.0
  [/v\d+\.\d+\.\d+/g, `v${newVer}`],
  // ensure logo line uses app logo
  [/<img src="[^"]*icon\.svg"/g, `<img src="assets/icon.svg"`],
]);

console.log(`\n✓ Tüm dosyalar v${newVer} ile senkronlandı`);
console.log(`  - README badge ve logo (assets/icon.svg) senkron`);
console.log(`  - Sonraki adım: git add . && git commit -m "chore: bump v${newVer}" && git tag v${newVer} && git push origin main --tags`);
