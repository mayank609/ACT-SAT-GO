const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Connecting to database...');
    
    console.log('Dropping unique constraint on TestAssignment...');
    await pool.query(`
      ALTER TABLE "TestAssignment" DROP CONSTRAINT IF EXISTS "TestAssignment_testId_studentId_key";
    `);
    
    console.log('✓ Migration completed successfully');
    console.log('Students can now be assigned the same test multiple times.');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
