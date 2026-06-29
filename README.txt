收支核对 PWA v3

核心功能：
- 全中文界面
- 布局：收入 | 支出 | 状态
- 每行记录：收入姓名、收入金额、支出姓名、支出金额、核对状态
- 底部自动汇总：收入、支出、差额
- 手机端自动变为舒适的纵向卡片布局
- 可调整显示大小
- 可切换紧凑模式
- 刷新、关闭浏览器、重新打开后数据仍保留
- 数据双重保存：IndexedDB + localStorage
- PWA 文件缓存：service-worker
- 每行可上传并保存凭证图片
- 可将当前表格保存为 PNG 图片
- 可导出/导入 JSON 备份

GitHub Pages 更新方式：
1. Extract ZIP.
2. Upload/replace semua file ke root repository:
   index.html
   style.css
   app.js
   manifest.json
   service-worker.js
3. Commit changes.
4. GitHub Pages: main / (root).
5. Buka: https://codeszhal.github.io/app/

Catatan:
- Data tetap lokal di browser pengguna.
- Data hilang jika user clear browser/site data, ganti domain, atau reset Safari data.
- Untuk operasional multi-user/cloud, perlu backend database seperti Supabase/Firebase.
