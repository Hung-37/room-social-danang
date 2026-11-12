import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const packages = ['next', 'react', 'react-dom', 'cheerio', 'mysql2', 'typescript'];
let missing = false;
for (const name of packages) {
  try { console.log(`OK      ${name}: ${require.resolve(`${name}/package.json`)}`); }
  catch { console.error(`MISSING ${name}`); missing = true; }
}
if (missing) {
  console.error('\nThiếu dependencies. Chạy npm ci trong môi trường có kết nối npm registry, sau đó npm run build && npm test.');
  process.exitCode = 1;
}
