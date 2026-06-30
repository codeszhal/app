收支核对 PWA v10 - 3 Columns + Telegram

- 每个 section 是三列：姓名 | 金额 | 合计。
- 收入 = 热色；支出 = 冷色。
- 金额栏保存原始输入，不会被替换；合计栏显示计算结果。
- 金额支持 + - * / × ÷，末尾等号、多空格、多行都可处理。
- 金额无法计算时，合计栏给出错误视觉，但保留上一次有效金额。
- 金额栏有“全”查看/编辑长文本，有“发”发送该侧到 Telegram。
- Telegram 支持 Lobeng/Ocha、发送给选中、发送给全部、复制内容。
- 真正发送需要填写 Bot Token。不要把 Bot Token hardcode 到 public repo。
- PWA ready: index.html, style.css, app.js, manifest.json, service-worker.js。

UI test:
- npm install
- npx playwright install
- npm run test:ui

Telegram smoke test:
- TELEGRAM_BOT_TOKEN=... npm run test:telegram
- TELEGRAM_BOT_TOKEN=... TELEGRAM_SMOKE_CHAT_ID=6201817840 npm run test:telegram

GitHub Pages:
- .nojekyll keeps files served as-is.
- .github/workflows/deploy-pages.yml deploys the static site from main.
- service-worker.js uses cache-first and keeps old caches; bump CACHE_NAME when you intentionally need clients to refresh app assets.
- Data is stored locally in browser localStorage + IndexedDB. The app requests persistent storage when supported, but iOS/browser storage can still be cleared by the OS/user, so keep using export backup for important data.
