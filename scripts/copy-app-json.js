// scripts/copy-app-json.js
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', 'app.json');          // 项目根目录的 app.json
const dest = path.resolve(__dirname, '..', '..', 'app.json');   // 上一级目录的 app.json

if (!fs.existsSync(src)) {
  console.error('❌ 未找到 app.json，请确认项目根目录下有 app.json');
  process.exit(1);
}

try {
  fs.copyFileSync(src, dest);
  console.log('✅ 已将 app.json 复制到上一级目录:', dest);
} catch (e) {
  console.warn('⚠️ 复制 app.json 失败（可能没有写权限）:', e.message);
}