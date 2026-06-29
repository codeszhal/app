收支核对 PWA v8 - iPhone Portrait Table

Fokus v8:
- Tampilan dirombak menjadi tabel empat kolom yang fit di iPhone 14 Pro Max portrait.
- Kolom utama:
  收入姓名 | 收入金额 | 支出姓名 | 支出金额
- Status tidak lagi menjadi kolom kelima agar tidak memakan lebar. Status ditampilkan sebagai bar kecil + pill kecil di bawah tiap baris.
- UI dibuat lebih hemat ruang: header compact, toolbar compact, settings collapsible.
- Tetap estetik, tetap full bahasa China.
- Tetap ada mode 纵向 / 表格.
- Tetap adjustable: 显示大小 + 紧凑/舒适.
- Nominal tetap bisa operasi matematika:
  100+20, 500-75, 12*3, 1000/4, 100×3, 1000÷4.
- Data tetap autosave ke IndexedDB + localStorage.
- Bisa upload/lihat gambar bukti per baris.
- Bisa simpan laporan menjadi PNG.
- Bisa export/import backup JSON.
- PWA ready untuk GitHub Pages.

Update GitHub Pages:
1. Extract ZIP.
2. Replace:
   index.html
   style.css
   app.js
   manifest.json
   service-worker.js
3. Commit.
4. Pastikan Settings > Pages: main / (root).
5. Buka https://codeszhal.github.io/app/

Jika tampilan lama masih muncul:
- Buka incognito untuk test.
- Atau hapus icon PWA lama dari Home Screen dan Add to Home Screen ulang.
