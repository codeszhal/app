收支核对 PWA v12 - Live Watchdog + Clean UI

Revisi:
1. Tombol kecil di kolom 金额 dihapus:
   - 全 dihapus
   - 发 dihapus
2. Tombol upload/view gambar per baris dihapus:
   - 图 dihapus
   - 看 dihapus
   - tombol delete × tetap ada
3. Kalkulasi live diperkuat:
   - oninput
   - onkeyup
   - onchange
   - onpaste
   - onblur
   - safety watchdog setiap 2 detik
4. Jika user mengetik tanpa event final, sistem tetap melakukan re-check otomatis tiap 2 detik.
5. Telegram contacts:
   - Lobeng: 5137608953
   - Ocha: 5817507946
   - Faisal: 6201817840

Catatan keamanan:
- Bot Token TIDAK di-hardcode ke file frontend karena repository/public PWA akan mengekspos token.
- Paste token sekali di field Bot Token; aplikasi menyimpannya di localStorage browser.
- Karena token sudah pernah dibagikan di chat, sebaiknya rotate/revoke token di BotFather sebelum production.

Replace:
- index.html
- style.css
- app.js
- manifest.json
- service-worker.js
