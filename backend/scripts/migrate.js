import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
};

const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredVars.filter(name => !process.env[name]);
if (missingVars.length) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

async function migrate() {
  console.log('🔄 Connecting to TiDB Cloud Server...');
  const connection = await mysql.createConnection(dbConfig);
  
  console.log(`🔨 Creating database ${process.env.DB_NAME} if not exists...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
  await connection.end();

  console.log(`🔄 Connecting to ${process.env.DB_NAME}...`);
  const db = await mysql.createConnection({
    ...dbConfig,
    database: process.env.DB_NAME
  });

  console.log('📖 Reading schema.sql...');
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('🚀 Running schema queries...');
  // Split strictly by semicolon
  const schemaQueries = schemaSql
    .split(';')
    .map(q => q.trim())
    .filter(q => q.length > 0);

  for (let query of schemaQueries) {
    if (query.toUpperCase().startsWith('USE')) continue;
    // Clean up SQL comments from the query
    const cleanedQuery = query
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim();

    if (cleanedQuery.length === 0) continue;

    console.log(`Executing query: ${cleanedQuery.substring(0, 50)}...`);
    try {
      await db.query(cleanedQuery);
    } catch (err) {
      console.error(`❌ Failed query: ${cleanedQuery}`);
      console.error(`Error: ${err.message}`);
      throw err; // Stop execution on error
    }
  }
  console.log('✅ Schema created successfully!');

  console.log('📖 Reading seed.sql...');
  const seedPath = path.join(__dirname, '..', 'sql', 'seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf8');

  console.log('🚀 Running seed queries...');
  const seedQueries = seedSql
    .split(';')
    .map(q => q.trim())
    .filter(q => q.length > 0);

  for (let query of seedQueries) {
    if (query.toUpperCase().startsWith('USE')) continue;
    
    const cleanedQuery = query
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim();

    if (cleanedQuery.length === 0) continue;

    console.log(`Executing seed query: ${cleanedQuery.substring(0, 50)}...`);
    try {
      await db.query(cleanedQuery);
    } catch (err) {
      console.error(`❌ Failed seed query: ${cleanedQuery}`);
      console.error(`Error: ${err.message}`);
      throw err;
    }
  }
  console.log('✅ Seed data inserted successfully!');

  await db.end();
  console.log('🎉 Database Migration & Seeding Completed successfully!');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
