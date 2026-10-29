import dotenv from 'dotenv';
import pool from '../config/db.js';

dotenv.config();

const promoteOwner = async () => {
  const targetEmail = process.argv[2];

  if (!targetEmail) {
    console.error('❌ Error: Target email argument is required.');
    console.log('Usage: node scripts/promoteOwner.js <user-email>');
    process.exit(1);
  }

  const normalizedEmail = targetEmail.trim().toLowerCase();
  const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();

  if (!ownerEmail) {
    console.error('❌ Error: OWNER_EMAIL environment variable is not set in backend/.env');
    process.exit(1);
  }

  if (normalizedEmail !== ownerEmail) {
    console.error(`❌ Error: Target email (${normalizedEmail}) does not match configured OWNER_EMAIL environment variable.`);
    process.exit(1);
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT id, name, email, role FROM users WHERE email = ? FOR UPDATE',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      await conn.rollback();
      console.error(`❌ Error: Account with email "${normalizedEmail}" not found. Please register the user account first.`);
      conn.release();
      process.exit(1);
    }

    const user = rows[0];

    if (user.role === 'owner') {
      await conn.rollback();
      console.log(`ℹ️ Account "${user.name}" (${user.email}) is already assigned the 'owner' role.`);
      conn.release();
      process.exit(0);
    }

    await conn.execute(
      'UPDATE users SET role = "owner", token_version = token_version + 1 WHERE id = ?',
      [user.id]
    );

    await conn.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [user.id, 'Account promoted to owner via CLI']
    );

    await conn.commit();

    console.log(`✅ Success: User "${user.name}" (${user.email}, ID: ${user.id}) has been successfully promoted to 'owner'.`);
  } catch (err) {
    if (conn) {
      await conn.rollback();
    }
    console.error('❌ Error promoting user to owner:', err.message);
    process.exit(1);
  } finally {
    if (conn) {
      conn.release();
    }
    process.exit(0);
  }
};

promoteOwner();
