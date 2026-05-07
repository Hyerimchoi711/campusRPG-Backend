const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES = '7d';
const FRIEND_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function generateFriendCode(conn) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += FRIEND_CODE_CHARS[Math.floor(Math.random() * FRIEND_CODE_CHARS.length)];
    }
    const [rows] = await conn.query(
      'SELECT id FROM users WHERE friend_code = ?',
      [code]
    );
    if (rows.length === 0) return code;
  }
  throw new Error('FRIEND_CODE');
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase();
}

function parseRegisterBody(body) {
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  const student_id = typeof body.student_id === 'string' ? body.student_id.trim() : '';
  const major = typeof body.major === 'string' ? body.major.trim() : '';
  const university_name =
    typeof body.university_name === 'string' ? body.university_name.trim() : '';
  const ageRaw = body.age;
  const age = typeof ageRaw === 'number' ? ageRaw : parseInt(String(ageRaw), 10);
  const schoolYearRaw = body.school_year;
  const school_year =
    typeof schoolYearRaw === 'number' ? schoolYearRaw : parseInt(String(schoolYearRaw), 10);

  return { email, password, nickname, student_id, major, university_name, age, school_year };
}

/** 이메일 또는 학번으로 로그인 */
router.post('/login', async (req, res) => {
  const rawId =
    typeof req.body.loginId === 'string'
      ? req.body.loginId
      : typeof req.body.email === 'string'
        ? req.body.email
        : '';
  const loginId = String(rawId)
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!loginId || !password) {
    return res.status(400).json({ error: '이메일(또는 학번)과 비밀번호를 입력해 주세요.' });
  }

  try {
    let rows;
    if (loginId.includes('@')) {
      const emailNorm = normalizeEmail(loginId);
      [rows] = await db.query(
        'SELECT id, `password` AS pwd_hash, nickname, email FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
        [emailNorm]
      );
    } else {
      [rows] = await db.query(
        'SELECT id, `password` AS pwd_hash, nickname, email FROM users WHERE student_id = ? LIMIT 1',
        [loginId]
      );
    }

    if (!rows.length) {
      return res.status(401).json({ error: '이메일(학번) 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = rows[0];
    let hash = user.pwd_hash ?? '';
    if (Buffer.isBuffer(hash)) {
      hash = hash.toString('utf8');
    } else {
      hash = String(hash || '');
    }
    const isBcrypt = hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
    const passwordOk = isBcrypt
      ? await bcrypt.compare(password, hash)
      : hash === password;

    if (!passwordOk) {
      return res.status(401).json({ error: '이메일(학번) 또는 비밀번호가 올바르지 않습니다.' });
    }

    if (!isBcrypt && hash) {
      const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await db.query('UPDATE users SET `password` = ? WHERE id = ?', [newHash, user.id]);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'your_jwt_secret_key') {
      console.warn('[auth] JWT_SECRET을 .env에서 안전한 값으로 바꿔 주세요.');
    }
    const token = jwt.sign({ userId: Number(user.id) }, secret || 'dev-insecure', {
      expiresIn: JWT_EXPIRES,
    });

    return res.json({
      ok: true,
      token,
      user: { id: user.id, nickname: user.nickname, email: user.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

router.post('/register', async (req, res) => {
  const { email, password, nickname, student_id, major, university_name, age, school_year } =
    parseRegisterBody(req.body || {});

  if (
    !email ||
    !password ||
    !nickname ||
    !student_id ||
    !major ||
    !university_name ||
    !Number.isFinite(age) ||
    !Number.isFinite(school_year)
  ) {
    return res.status(400).json({ error: '모든 필드를 입력해 주세요.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
  }
  if (nickname.length > 50 || student_id.length > 30 || major.length > 80 || university_name.length > 120) {
    return res.status(400).json({ error: '입력 길이가 제한을 초과했습니다.' });
  }
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    return res.status(400).json({ error: '나이는 1~120 사이 정수여야 합니다.' });
  }
  if (!Number.isInteger(school_year) || school_year < 1 || school_year > 4) {
    return res.status(400).json({ error: '학년은 1~4 사이 정수여야 합니다.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    const friendCode = await generateFriendCode(conn);

    const [result] = await conn.query(
      `INSERT INTO users (
        email, \`password\`, nickname, student_id, major, university_name, age, school_year, friend_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, passwordHash, nickname, student_id, major, university_name, age, school_year, friendCode]
    );

    const userId = result.insertId;

    await conn.query(
      `INSERT INTO pets (user_id, name, level, evolution_stage, animal_type, lineage_type)
       VALUES (?, '부화중인 알', 1, 0, 'egg', NULL)`,
      [userId]
    );
    await conn.query(
      `INSERT INTO stats (user_id, health, social, diligence, focus, creativity, daily_fatigue, last_updated_date)
       VALUES (?, 0, 0, 0, 0, 0, 0, date('now'))`,
      [userId]
    );

    await conn.commit();
    return res.status(201).json({
      ok: true,
      userId,
      friendCode,
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'SQLITE_CONSTRAINT') {
      if (String(err.message).includes('email')) {
        return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
      }
      if (
        String(err.message).includes('uk_student_id') ||
        String(err.message).includes('student_id')
      ) {
        return res.status(409).json({ error: '이미 사용 중인 학번입니다.' });
      }
      if (String(err.message).includes('friend_code')) {
        return res.status(409).json({ error: '가입 처리 중 충돌이 났습니다. 다시 시도해 주세요.' });
      }
      return res.status(409).json({ error: '중복된 정보가 있습니다.' });
    }
    if (err.message === 'FRIEND_CODE') {
      return res.status(500).json({ error: '친구 코드 생성에 실패했습니다.' });
    }
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
