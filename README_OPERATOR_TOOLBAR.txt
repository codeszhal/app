Operator Toolbar Update

File yang berubah:
- index.html
- style.css
- app.js
- manifest.json
- service-worker.js

Fitur:
- Saat fokus di kolom nominal, muncul toolbar operator:
  ＋ － × ÷ ( ) . ⌫
- Keyboard angka HP tetap dipertahankan karena input tetap memakai inputmode="decimal".
- Operator toolbar bekerja di Android Chrome dan iPhone Chrome/Safari/PWA.
- Logic kalkulator lama tetap dipakai:
  100+20, 500-75, 12*3, 1000/4, 100×3, 1000÷4.

Cara pakai:
1. Copy semua file hasil extract ke folder project/repository.
2. Replace file lama.
3. Commit ke GitHub Pages.
4. Jika tampilan lama masih muncul, clear cache/PWA lama.
