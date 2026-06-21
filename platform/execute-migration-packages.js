const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Connecting to database...');
    const sql = fs.readFileSync(
      path.join(__dirname, 'prisma/migrations/2_add_test_packages/migration.sql'),
      'utf8'
    );
    console.log('Creating TestPackage / TestPackageItem tables...');
    await pool.query(sql);
    console.log('✓ Migration completed successfully');
    console.log('Test packages are ready. You can now bundle tests and assign them at once.');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
