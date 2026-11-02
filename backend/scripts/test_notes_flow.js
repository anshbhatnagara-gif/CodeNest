import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool, { connectDB } from '../config/db.js';
import authRoutes from '../routes/authRoutes.js';
import courseRoutes from '../routes/courseRoutes.js';
import progressRoutes from '../routes/progressRoutes.js';
import ownerRoutes from '../routes/ownerRoutes.js';
import notesRoutes from '../routes/notesRoutes.js';
import ownerNotesRoutes from '../routes/ownerNotesRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });
 
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/owner/notes', ownerNotesRoutes);

async function runNotesTestSuite() {
  console.log('================================================================');
  console.log('📝 CodeNest Free Academy — Notes Management Test Suite');
  console.log('================================================================\n');

  await connectDB();

  const PORT = 5077;
  const server = app.listen(PORT, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${PORT}/api`;
  console.log(`Test API Server running at ${baseUrl}\n`);

  const timestamp = Date.now();
  const ownerEmail = (process.env.OWNER_EMAIL || 'anshbhatnagara@gmail.com').toLowerCase().trim();
  const ownerPassword = 'OwnerPassword123!';
  const studentEmail = `student.notes.${timestamp}@example.com`;
  const studentPassword = 'StudentPassword123!';

  let ownerToken = null;
  let studentToken = null;
  let ownerUserId = null;
  let studentUserId = null;
  let createdNoteId = null;

  try {
    console.log('1️⃣ [Setup Test Users]');
    // Check if owner exists, else register owner
    const [ownerRows] = await pool.execute('SELECT id, email, role FROM users WHERE email = ?', [ownerEmail]);
    if (ownerRows.length > 0) {
      ownerUserId = ownerRows[0].id;
    } else {
      const regOwnerRes = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Ansh Bhatnagar (Owner)',
          email: ownerEmail,
          password: ownerPassword
        })
      });
      const regOwnerData = await regOwnerRes.json();
      ownerUserId = regOwnerData.user.id;
    }

    // Login owner
    // Update owner password for testing if needed
    const bcrypt = (await import('bcryptjs')).default;
    const hashedPass = await bcrypt.hash(ownerPassword, 12);
    await pool.execute("UPDATE users SET password = ?, role = 'owner' WHERE id = ?", [hashedPass, ownerUserId]);

    const ownerLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword })
    });
    const ownerLoginData = await ownerLoginRes.json();
    ownerToken = ownerLoginData.token;
    console.log(`  ✅ Owner logged in: ID=${ownerUserId}, Role=${ownerLoginData.user.role}`);

    // Register & login student
    const studentRegRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Student Tester',
        email: studentEmail,
        password: studentPassword
      })
    });
    const studentRegData = await studentRegRes.json();
    studentUserId = studentRegData.user.id;
    studentToken = studentRegData.token;
    console.log(`  ✅ Student registered & logged in: ID=${studentUserId}, Role=${studentRegData.user.role}`);

    // Get a sample course
    const [courseRows] = await pool.execute('SELECT id, title FROM courses LIMIT 1');
    if (courseRows.length === 0) throw new Error('No courses in database!');
    const sampleCourse = courseRows[0];
    console.log(`  ✅ Target Course: "${sampleCourse.title}" (ID=${sampleCourse.id})\n`);

    console.log('2️⃣ [Owner Creates a Draft Note with File Upload]');
    // Create a temporary sample PDF/TXT file
    const tempFilePath = path.join(__dirname, '..', 'uploads', 'notes', `sample_cheat_sheet_${timestamp}.txt`);
    fs.writeFileSync(tempFilePath, 'Sample JavaScript & HTML cheat sheet content for testing.');

    const formData = new FormData();
    formData.append('title', `JS Fundamentals Cheat Sheet ${timestamp}`);
    formData.append('description', 'Comprehensive summary of variables, loops, and DOM APIs.');
    formData.append('content', '# JavaScript Cheat Sheet\n\n```js\nconst greeting = "Hello CodeNest";\n```');
    formData.append('course_id', sampleCourse.id.toString());
    formData.append('status', 'draft');

    const fileBuffer = fs.readFileSync(tempFilePath);
    const fileBlob = new Blob([fileBuffer], { type: 'text/plain' });
    formData.append('file', fileBlob, `js_cheat_sheet_${timestamp}.txt`);

    const createNoteRes = await fetch(`${baseUrl}/owner/notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: formData
    });
    const createNoteData = await createNoteRes.json();
    if (createNoteRes.status !== 201 || !createNoteData.success) {
      throw new Error(`Create note failed: ${JSON.stringify(createNoteData)}`);
    }
    createdNoteId = createNoteData.note.id;
    console.log(`  ✅ Draft note created: ID=${createdNoteId}, Title="${createNoteData.note.title}", File="${createNoteData.note.file_name}"\n`);

    console.log('3️⃣ [Draft Visibility Verification]');
    // Student queries published notes -> draft note must NOT appear
    const studentNotesRes = await fetch(`${baseUrl}/notes?course_id=${sampleCourse.id}`);
    const studentNotesData = await studentNotesRes.json();
    const foundInStudent = studentNotesData.notes.find(n => n.id === createdNoteId);
    if (foundInStudent) {
      throw new Error('SECURITY VIOLATION: Student was able to view a DRAFT note!');
    }
    console.log('  ✅ Verified: Draft note is NOT visible to student.\n');

    console.log('4️⃣ [Student Unauthorized Access Check]');
    // Student tries POST /api/owner/notes
    const hackPostRes = await fetch(`${baseUrl}/owner/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ title: 'Hacked Note', course_id: sampleCourse.id })
    });
    console.log(`  ✅ Student POST /api/owner/notes returned status ${hackPostRes.status} (Forbidden)`);
    if (hackPostRes.status !== 403) throw new Error(`Expected 403 for student, got ${hackPostRes.status}`);

    // Student tries DELETE /api/owner/notes/:id
    const hackDelRes = await fetch(`${baseUrl}/owner/notes/${createdNoteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log(`  ✅ Student DELETE /api/owner/notes/:id returned status ${hackDelRes.status} (Forbidden)\n`);
    if (hackDelRes.status !== 403) throw new Error(`Expected 403 for student, got ${hackDelRes.status}`);

    console.log('5️⃣ [Owner Publishes Note]');
    const pubRes = await fetch(`${baseUrl}/owner/notes/${createdNoteId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ status: 'published' })
    });
    const pubData = await pubRes.json();
    if (pubRes.status !== 200 || !pubData.success) {
      throw new Error(`Publish note failed: ${JSON.stringify(pubData)}`);
    }
    console.log(`  ✅ Note status updated: "${pubData.message}"\n`);

    console.log('6️⃣ [Student Views & Reads Published Note]');
    const studentPubRes = await fetch(`${baseUrl}/notes?course_id=${sampleCourse.id}`);
    const studentPubData = await studentPubRes.json();
    const publishedNote = studentPubData.notes.find(n => n.id === createdNoteId);
    if (!publishedNote) {
      throw new Error('Published note not found in student query!');
    }
    console.log(`  ✅ Student sees published note: "${publishedNote.title}" (File: ${publishedNote.file_type})`);

    const detailRes = await fetch(`${baseUrl}/notes/${createdNoteId}`);
    const detailData = await detailRes.json();
    if (detailRes.status !== 200 || !detailData.success) {
      throw new Error(`Get note detail failed: ${JSON.stringify(detailData)}`);
    }
    console.log(`  ✅ Student fetched note detail with content length ${detailData.note?.content?.length || 0} bytes.\n`);

    console.log('7️⃣ [Owner Edits Note Content]');
    const editRes = await fetch(`${baseUrl}/owner/notes/${createdNoteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        title: `Updated JS Cheat Sheet ${timestamp}`,
        description: 'Updated with async/await patterns.',
        content: 'New content',
        course_id: sampleCourse.id
      })
    });
    const editData = await editRes.json();
    if (editRes.status !== 200 || !editData.success) {
      throw new Error(`Edit note failed: ${JSON.stringify(editData)}`);
    }
    console.log(`  ✅ Note successfully updated: Title="${editData.note.title}"\n`);

    console.log('8️⃣ [Owner Notes Directory & Summary Metrics]');
    const ownerNotesRes = await fetch(`${baseUrl}/owner/notes`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const ownerNotesData = await ownerNotesRes.json();
    console.log(`  ✅ Owner stats: Total=${ownerNotesData.stats.total_notes}, Published=${ownerNotesData.stats.published_notes}, Drafts=${ownerNotesData.stats.draft_notes}`);

    console.log('\n9️⃣ [Owner Deletes Note]');
    const delRes = await fetch(`${baseUrl}/owner/notes/${createdNoteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const delData = await delRes.json();
    if (delRes.status !== 200 || !delData.success) {
      throw new Error(`Delete note failed: ${JSON.stringify(delData)}`);
    }
    console.log(`  ✅ Note deleted: "${delData.message}"`);

    // Verify it is gone for students
    const checkGoneRes = await fetch(`${baseUrl}/notes?course_id=${sampleCourse.id}`);
    const checkGoneData = await checkGoneRes.json();
    if (checkGoneData.notes.some(n => n.id === createdNoteId)) {
      throw new Error('Deleted note still visible!');
    }
    console.log('  ✅ Verified: Deleted note is no longer listed.\n');
    createdNoteId = null;

    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

  } finally {
    if (createdNoteId) {
      await pool.execute('DELETE FROM notes WHERE id = ?', [createdNoteId]);
    }
    if (studentUserId) {
      await pool.execute('DELETE FROM users WHERE id = ?', [studentUserId]);
      console.log(`Cleaned up student test user ${studentUserId}`);
    }
    server.close();
    await pool.end();
  }

  console.log('================================================================');
  console.log('🎉 ALL NOTES MANAGEMENT TESTS PASSED WITH 100% SUCCESS!');
  console.log('================================================================\n');
}

runNotesTestSuite().catch(err => {
  console.error('❌ Notes Test Suite Failed:', err);
  process.exit(1);
});
