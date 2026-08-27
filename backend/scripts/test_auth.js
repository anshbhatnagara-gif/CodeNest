import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const poolConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  timezone: '+05:30'
};

if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  };
}

async function runTests() {
  console.log('--- Step 1: Connecting to TiDB database ---');
  const pool = mysql.createPool(poolConfig);
  const conn = await pool.getConnection();
  console.log(`Database connected successfully to ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  conn.release();

  console.log('\n--- Step 2: Verifying required tables ---');
  const requiredTables = ['users', 'courses', 'modules', 'enrollments', 'progress', 'activity_logs'];
  const [tables] = await pool.execute('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log('Existing tables in DB:', tableNames.join(', '));
  for (const reqTable of requiredTables) {
    if (tableNames.includes(reqTable)) {
      console.log(`  ✅ Table [${reqTable}] exists`);
    } else {
      console.error(`  ❌ Table [${reqTable}] is MISSING!`);
    }
  }

  console.log('\n--- Step 3: Testing User Registration Logic ---');
  const testEmail = `codenest.test.${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test User';
  const testPhone = '+91 9999999999';

  console.log(`Attempting to register user: ${testEmail}`);
  const hashedPassword = await bcrypt.hash(testPassword, 12);
  const ownerEmail = (process.env.OWNER_EMAIL || '').toLowerCase().trim();
  const role = testEmail.toLowerCase() === ownerEmail ? 'owner' : 'student';

  const [regResult] = await pool.execute(
    'INSERT INTO users (name, email, phone, password, role, last_active_at) VALUES (?, ?, ?, ?, ?, NOW())',
    [testName.trim(), testEmail.toLowerCase().trim(), testPhone, hashedPassword, role]
  );
  const newUserId = regResult.insertId;
  console.log(`  ✅ User inserted into DB with ID: ${newUserId}`);

  await pool.execute(
    'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
    [newUserId, 'Account registered']
  );
  console.log(`  ✅ Activity log created for user ${newUserId}`);

  console.log('\n--- Step 4: Testing User Query & Data Verification ---');
  const [userRows] = await pool.execute(
    'SELECT id, name, email, phone, role, xp, level, created_at, last_login_at, last_active_at FROM users WHERE id = ?',
    [newUserId]
  );
  if (userRows.length > 0) {
    const u = userRows[0];
    console.log(`  ✅ User query result: ID=${u.id}, Name=${u.name}, Email=${u.email}, Role=${u.role}, XP=${u.xp}, Level=${u.level}, CreatedAt=${u.created_at}`);
  } else {
    throw new Error('Inserted user not found!');
  }

  console.log('\n--- Step 5: Testing Password Verification (Login logic) ---');
  const [loginRows] = await pool.execute('SELECT * FROM users WHERE email = ?', [testEmail.toLowerCase().trim()]);
  const user = loginRows[0];
  const isMatch = await bcrypt.compare(testPassword, user.password);
  console.log(`  ✅ Password match result: ${isMatch}`);
  if (!isMatch) throw new Error('Password verification failed!');

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  console.log(`  ✅ JWT generated successfully`);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log(`  ✅ JWT verified successfully: id=${decoded.id}, email=${decoded.email}, role=${decoded.role}`);

  console.log('\n--- Step 6: Cleaning up test user ---');
  await pool.execute('DELETE FROM users WHERE id = ?', [newUserId]);
  console.log(`  ✅ Test user ${newUserId} cleaned up`);

  await pool.end();
  console.log('\n🎉 ALL BACKEND & DATABASE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
