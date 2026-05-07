const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES = '7d';
const FRIEND_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USERINFO_URL = 'https://kapi.kakao.com/v2/user/me';

function getKakaoConfig() {
  return {
    restApiKey: process.env.KAKAO_REST_API_KEY || '',
    clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
    redirectUri: process.env.KAKAO_REDIRECT_URI || '',
  };
}

function createJwtToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'your_jwt_secret_key') {
    console.warn('[auth] JWT_SECRET을 .env에서 안전한 값으로 바꿔 주세요.');
  }
  return jwt.sign({ userId: Number(userId) }, secret || 'dev-insecure', {
    expiresIn: JWT_EXPIRES,
  });
}

async function generateFriendCode(conn) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += FRIEND_CODE_CHARS[Math.floor(Math.random() * FRIEND_CODE_CHARS.length)];
    }
    const [rows] = await conn.query('SELECT id FROM users WHERE friend_code = ?', [code]);
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

function hasVerifiedKakaoEmail(kakaoAccount) {
  return (
    kakaoAccount &&
    kakaoAccount.email &&
    kakaoAccount.is_email_valid !== false &&
    kakaoAccount.is_email_verified !== false
  );
}

function buildKakaoEmail(kakaoId, kakaoAccount) {
  if (!hasVerifiedKakaoEmail(kakaoAccount)) {
    return `kakao_${kakaoId}@kakao.local`;
  }
  const email = normalizeEmail(kakaoAccount?.email);
  return email || `kakao_${kakaoId}@kakao.local`;
}

function buildNickname(kakaoId, properties, kakaoAccount) {
  const profile = kakaoAccount?.profile || {};
  const nickname = String(profile.nickname || properties?.nickname || '').trim();
  return nickname || `kakao_${kakaoId}`;
}

async function ensureKakaoSchema() {
  const [columns] = await db.query('PRAGMA table_info(users)');
  const hasKakaoId = columns.some(column => column.name === 'kakao_id');
  if (!hasKakaoId) {
    await db.query('ALTER TABLE users ADD COLUMN kakao_id TEXT');
  }
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS uk_users_kakao_id ON users(kakao_id)');
}

async function requestKakaoToken({ code, redirectUri, restApiKey, clientSecret }) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: restApiKey,
    redirect_uri: redirectUri,
    code,
  });
  if (clientSecret) {
    params.set('client_secret', clientSecret);
  }

  const response = await fetch(KAKAO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: params,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const error = new Error('KAKAO_TOKEN_FAILED');
    error.status = response.status;
    error.detail = data;
    throw error;
  }
  return data.access_token;
}

async function requestKakaoUser(accessToken) {
  const response = await fetch(KAKAO_USERINFO_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    const error = new Error('KAKAO_USER_FAILED');
    error.status = response.status;
    error.detail = data;
    throw error;
  }
  return data;
}

async function findOrCreateKakaoUser(kakaoUser) {
  await ensureKakaoSchema();

  const kakaoId = String(kakaoUser.id);
  const email = buildKakaoEmail(kakaoId, kakaoUser.kakao_account);
  const canLinkByEmail = hasVerifiedKakaoEmail(kakaoUser.kakao_account);
  const nickname = buildNickname(kakaoId, kakaoUser.properties, kakaoUser.kakao_account);

  const [linkedRows] = await db.query(
    'SELECT id, nickname, email FROM users WHERE kakao_id = ? LIMIT 1',
    [kakaoId]
  );
  if (linkedRows.length) return linkedRows[0];

  if (canLinkByEmail) {
    const [emailRows] = await db.query(
      'SELECT id, nickname, email FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
      [email]
    );
    if (emailRows.length) {
      await db.query('UPDATE users SET kakao_id = ? WHERE id = ?', [kakaoId, emailRows[0].id]);
      return emailRows[0];
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const friendCode = await generateFriendCode(conn);
    const studentId = `kakao_${kakaoId}`.slice(0, 30);
    const password = await bcrypt.hash(`kakao:${crypto.randomBytes(32).toString('hex')}`, BCRYPT_ROUNDS);

    const [result] = await conn.query(
      `INSERT INTO users (
        email, \`password\`, nickname, student_id, major, university_name, age, friend_code, kakao_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, password, nickname, studentId, '미입력', '미입력', 1, friendCode, kakaoId]
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
    return { id: userId, nickname, email };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

router.get('/start', (req, res) => {
  const { restApiKey, redirectUri } = getKakaoConfig();
  if (!restApiKey || !redirectUri) {
    return res.status(500).json({ error: '카카오 로그인 환경 변수가 설정되지 않았습니다.' });
  }

  const params = new URLSearchParams({
    client_id: restApiKey,
    redirect_uri: redirectUri,
    response_type: 'code',
  });

  return res.json({
    authUrl: `${KAKAO_AUTHORIZE_URL}?${params.toString()}`,
  });
});

router.post('/', async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const redirectUri = typeof req.body?.redirectUri === 'string' ? req.body.redirectUri.trim() : '';
  const config = getKakaoConfig();

  if (!config.restApiKey || !config.redirectUri) {
    return res.status(500).json({ error: '카카오 로그인 환경 변수가 설정되지 않았습니다.' });
  }
  if (!code || !redirectUri) {
    return res.status(400).json({ error: '인가 코드와 redirectUri를 입력해 주세요.' });
  }
  if (redirectUri !== config.redirectUri) {
    return res.status(400).json({ error: 'redirectUri가 서버 설정과 일치하지 않습니다.' });
  }

  try {
    const accessToken = await requestKakaoToken({
      code,
      redirectUri,
      restApiKey: config.restApiKey,
      clientSecret: config.clientSecret,
    });
    const kakaoUser = await requestKakaoUser(accessToken);
    const user = await findOrCreateKakaoUser(kakaoUser);
    const token = createJwtToken(user.id);

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
      },
    });
  } catch (err) {
    if (err.message === 'KAKAO_TOKEN_FAILED' || err.message === 'KAKAO_USER_FAILED') {
      console.error('[kakao auth]', err.message, err.status, err.detail);
      return res.status(401).json({ error: '카카오 인증에 실패했습니다.' });
    }
    if (err.message === 'FRIEND_CODE') {
      return res.status(500).json({ error: '친구 코드 생성에 실패했습니다.' });
    }
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: '카카오 사용자 생성 중 중복된 정보가 있습니다.' });
    }
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
