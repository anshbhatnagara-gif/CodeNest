import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { connectDB } from '../config/db.js';
import authRoutes from '../routes/authRoutes.js';
import courseRoutes from '../routes/courseRoutes.js';
import progressRoutes from '../routes/progressRoutes.js';
import ownerRoutes from '../routes/ownerRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/owner', ownerRoutes);

async function runApiTests() {
  await connectDB();
  const PORT = 5099;
  const server = app.listen(PORT, '127.0.0.1');
  console.log(`Test Express server listening on http://127.0.0.1:${PORT}`);

  const baseUrl = `http://127.0.0.1:${PORT}/api`;
  let testUserId = null;
  const testEmail = `codenest.test.${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  try {
    console.log('\n--- 1. Testing Registration API (POST /api/auth/register) ---');
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'API Test User',
        email: testEmail,
        phone: '1234567890',
        password: testPassword
      })
    });

    const regData = await regRes.json();
    console.log('Registration HTTP Status:', regRes.status);
    console.log('Registration Response:', JSON.stringify(regData));

    if (regRes.status !== 201 || !regData.success || !regData.token) {
      throw new Error(`Registration API failed! Status: ${regRes.status}, data: ${JSON.stringify(regData)}`);
    }
    testUserId = regData.user.id;
    console.log(`✅ Registration API passed! User ID: ${testUserId}`);

    console.log('\n--- 2. Testing Duplicate Registration (POST /api/auth/register) ---');
    const dupRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: testEmail,
        password: testPassword
      })
    });
    const dupData = await dupRes.json();
    console.log('Duplicate Reg Status:', dupRes.status);
    if (dupRes.status !== 409) {
      throw new Error(`Duplicate registration should return 409, got ${dupRes.status}`);
    }
    console.log('✅ Duplicate registration handled correctly (409 Conflict)');

    console.log('\n--- 3. Testing Login API (POST /api/auth/login) ---');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    const loginData = await loginRes.json();
    console.log('Login HTTP Status:', loginRes.status);
    console.log('Login Response success:', loginData.success, 'user role:', loginData.user?.role);
    if (loginRes.status !== 200 || !loginData.success || !loginData.token) {
      throw new Error(`Login API failed! Status: ${loginRes.status}, data: ${JSON.stringify(loginData)}`);
    }
    const token = loginData.token;
    console.log('✅ Login API passed!');

    console.log('\n--- 4. Testing Profile API (GET /api/auth/profile with Bearer token) ---');
    const profRes = await fetch(`${baseUrl}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const profData = await profRes.json();
    console.log('Profile HTTP Status:', profRes.status);
    console.log('Profile user:', profData.user?.name, profData.user?.email);
    if (profRes.status !== 200 || !profData.success) {
      throw new Error(`Profile API failed! Status: ${profRes.status}`);
    }
    console.log('✅ Profile API passed!');

    console.log('\n--- 5. Testing Invalid Password (POST /api/auth/login) ---');
    const badPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword999!'
      })
    });
    const badPassData = await badPassRes.json();
    console.log('Bad Password Status:', badPassRes.status, 'Message:', badPassData.message);
    if (badPassRes.status !== 401) {
      throw new Error(`Invalid password should return 401, got ${badPassRes.status}`);
    }
    console.log('✅ Bad password rejected properly');

    console.log('\n--- 6. Testing Nonexistent User (POST /api/auth/login) ---');
    const noUserRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody_exists_12345@example.com',
        password: 'Password123!'
      })
    });
    console.log('No user Status:', noUserRes.status);
    if (noUserRes.status !== 401) {
      throw new Error(`Nonexistent user should return 401, got ${noUserRes.status}`);
    }
    console.log('✅ Nonexistent user rejected properly');

    console.log('\n--- 7. Testing Courses API (GET /api/courses) ---');
    const coursesRes = await fetch(`${baseUrl}/courses`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const coursesData = await coursesRes.json();
    console.log('Courses count:', coursesData.courses?.length);
    if (coursesRes.status !== 200 || !coursesData.courses || coursesData.courses.length === 0) {
      throw new Error('Courses API failed to return course list');
    }
    console.log('✅ Courses API passed!');

    console.log('\n--- 8. Testing Course Enrollment & Progress ---');
    const firstCourseId = coursesData.courses[0].id;
    const enrollRes = await fetch(`${baseUrl}/courses/${firstCourseId}/enroll`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const enrollData = await enrollRes.json();
    console.log('Enroll Status:', enrollRes.status, 'Message:', enrollData.message);
    if (enrollRes.status !== 201) {
      throw new Error(`Course enrollment failed with status ${enrollRes.status}`);
    }
    console.log('✅ Course enrollment passed!');

  } finally {
    if (testUserId) {
      console.log('\n--- Cleaning up test user and associated records ---');
      await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
      console.log(`Cleaned up test user ${testUserId}`);
    }
    server.close();
    await pool.end();
  }

  console.log('\n🎉 ALL API ENDPOINT TESTS COMPLETED SUCCESSFULLY!');
}

runApiTests().catch(err => {
  console.error('❌ API Test Error:', err);
  process.exit(1);
});
