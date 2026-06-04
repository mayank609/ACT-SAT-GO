const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Connecting to DB to delete students...');
  try {
    const res = await pool.query("DELETE FROM \"User\" WHERE role = 'STUDENT'");
    console.log(`Successfully deleted ${res.rowCount} student(s) and their cascading records.`);
  } catch (err) {
    console.error('Error deleting students:', err);
  } finally {
    pool.end();
  }
}

main();
