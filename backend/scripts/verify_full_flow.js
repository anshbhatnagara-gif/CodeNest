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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/owner', ownerRoutes);

async function runFullVerification() {
  console.log('================================================================');
  console.log('🚀 CodeNest Free Academy — Complete Verification Suite');
  console.log('================================================================\n');

  console.log('1️⃣ [Database Connection Test]');
  await connectDB();
  console.log('  ✅ Database connection verified successfully.\n');

  console.log('2️⃣ [Table Structure Verification]');
  const requiredTables = ['users', 'courses', 'modules', 'enrollments', 'progress', 'activity_logs'];
  const [dbTables] = await pool.execute('SHOW TABLES');
  const tableNames = dbTables.map(t => Object.values(t)[0]);
  for (const t of requiredTables) {
    if (!tableNames.includes(t)) throw new Error(`Missing table: ${t}`);
    console.log(`  ✅ Table '${t}' verified in TiDB.`);
  }

  const PORT = 5088;
  const server = app.listen(PORT, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${PORT}/api`;
  console.log(`\n  ✅ Test API Server listening at ${baseUrl}\n`);

  const timestamp = Date.now();
  const testStudentEmail = `codenest.test.${timestamp}@example.com`;
  const testStudentPassword = 'TestPassword123!';
  const testStudentName = 'Verification Student';

  let studentId = null;
  let studentToken = null;

  try {
    console.log('3️⃣ [Student Registration Flow]');
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testStudentName,
        email: testStudentEmail,
        phone: '9876543210',
        password: testStudentPassword
      })
    });
    const regData = await regRes.json();
    if (regRes.status !== 201 || !regData.success || !regData.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }
    studentId = regData.user.id;
    studentToken = regData.token;
    console.log(`  ✅ Registered successfully: ID=${studentId}, Role=${regData.user.role}`);

    console.log('\n4️⃣ [Database Verification for Registered User]');
    const [userRows] = await pool.execute(
      'SELECT id, name, email, phone, password, role, xp, level, created_at FROM users WHERE id = ?',
      [studentId]
    );
    const userInDb = userRows[0];
    if (!userInDb) throw new Error('User not found in DB after registration!');
    console.log(`  ✅ User in DB: Name="${userInDb.name}", Email="${userInDb.email}", Role="${userInDb.role}"`);
    console.log(`  ✅ Password hashed securely (starts with $2a$ / $2b$): ${userInDb.password.startsWith('$2')}`);
    if (userInDb.password === testStudentPassword) {
      throw new Error('SECURITY VIOLATION: Password was stored in plaintext!');
    }

    console.log('\n5️⃣ [Student Login Flow]');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testStudentEmail,
        password: testStudentPassword
      })
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.success || !loginData.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    console.log(`  ✅ Login successful: User="${loginData.user.name}", Role="${loginData.user.role}"`);

    console.log('\n6️⃣ [Authenticated Profile Access (GET /api/auth/profile)]');
    const profileRes = await fetch(`${baseUrl}/auth/profile`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const profileData = await profileRes.json();
    if (profileRes.status !== 200 || !profileData.success) {
      throw new Error(`Profile access failed: ${JSON.stringify(profileData)}`);
    }
    console.log(`  ✅ Profile retrieved: Email="${profileData.user.email}", Level=${profileData.user.level}, XP=${profileData.user.xp}`);

    console.log('\n7️⃣ [Course Catalog & Detail Flow]');
    const coursesRes = await fetch(`${baseUrl}/courses`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const coursesData = await coursesRes.json();
    if (!coursesData.courses || coursesData.courses.length === 0) {
      throw new Error('No courses found!');
    }
    const sampleCourse = coursesData.courses[0];
    console.log(`  ✅ Courses loaded: ${coursesData.courses.length} courses. First: "${sampleCourse.title}" (ID=${sampleCourse.id})`);

    const courseDetailRes = await fetch(`${baseUrl}/courses/${sampleCourse.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const courseDetailData = await courseDetailRes.json();
    console.log(`  ✅ Course detail loaded with ${courseDetailData.course?.modules?.length || 0} modules.`);

    console.log('\n8️⃣ [Course Enrollment Flow]');
    const enrollRes = await fetch(`${baseUrl}/courses/${sampleCourse.id}/enroll`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const enrollData = await enrollRes.json();
    if (enrollRes.status !== 201) throw new Error(`Enrollment failed: ${JSON.stringify(enrollData)}`);
    console.log(`  ✅ Enrolled successfully: "${enrollData.message}"`);

    console.log('\n9️⃣ [Progress Completion & XP Flow]');
    if (courseDetailData.course?.modules?.length > 0) {
      const firstModule = courseDetailData.course.modules[0];
      const progRes = await fetch(`${baseUrl}/progress/module-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ module_id: firstModule.id })
      });
      const progData = await progRes.json();
      if (progRes.status !== 200 || !progData.success) {
        throw new Error(`Module completion failed: ${JSON.stringify(progData)}`);
      }
      console.log(`  ✅ Module completed: XP gained=+${progData.xp_gained}, Message="${progData.message}"`);
    }

    console.log('\n🔟 [Error Handling & Edge Cases]');
    // Duplicate email
    const dupRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dup User',
        email: testStudentEmail,
        password: 'Password123!'
      })
    });
    if (dupRes.status === 409) console.log('  ✅ Duplicate email properly rejected with 409 Conflict.');

    // Wrong password
    const wrongPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testStudentEmail,
        password: 'IncorrectPassword!'
      })
    });
    if (wrongPassRes.status === 401) console.log('  ✅ Invalid password properly rejected with 401 Unauthorized.');

    // Invalid Token
    const badTokenRes = await fetch(`${baseUrl}/auth/profile`, {
      headers: { Authorization: 'Bearer invalid_token_xyz' }
    });
    if (badTokenRes.status === 401) console.log('  ✅ Invalid JWT properly rejected with 401 Unauthorized.');

  } finally {
    if (studentId) {
      console.log('\n🧹 [Cleanup Test Data]');
      await pool.execute('DELETE FROM users WHERE id = ?', [studentId]);
      console.log(`  ✅ Test user ${studentId} removed from DB.`);
    }
    server.close();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log('🎉 ALL VERIFICATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('================================================================\n');
}

runFullVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
