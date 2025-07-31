let pool = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

module.exports = {
  pool,
  async query(text, params) {
    if (!pool) throw new Error('DATABASE_URL not configured');
    return pool.query(text, params);
  },
  async getClient() {
    if (!pool) throw new Error('DATABASE_URL not configured');
    return pool.connect();
  }
};
