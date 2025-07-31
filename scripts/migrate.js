const fs = require('fs');
const path = require('path');
const { pool } = require('../services/db');

async function runMigrations() {
  if (!pool) {
    console.log('DATABASE_URL not configured, skipping migrations');
    return;
  }
  const dir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query(sql);
  }
  console.log('Migrations applied');
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}

module.exports = runMigrations;
