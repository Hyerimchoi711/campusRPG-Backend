const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const MAX_BIO_LENGTH = 200;

function toProfileUser(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    studentId: row.student_id,
    major: row.major,
    universityName: row.university_name,
    age: row.age,
    grade: row.school_year,
    bio: row.intro,
    schoolYear: row.school_year,
    school_year: row.school_year,
    intro: row.intro,
    avatar: row.avatar,
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nickname, student_id, major, university_name, age, school_year, intro, avatar
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    return res.json({ user: toProfileUser(rows[0]) });
  } catch (err) {
    console.error('[profile:get]', err);
    return res.status(500).json({ error: 'PROFILE_FETCH_FAILED', message: 'Failed to fetch profile.' });
  }
});

router.post('/bio', requireAuth, async (req, res) => {
  const { bio } = req.body || {};

  if (typeof bio !== 'string') {
    return res.status(400).json({ error: 'INVALID_BIO', message: 'bio must be a string.' });
  }

  const normalizedBio = bio.trim();
  if (normalizedBio.length > MAX_BIO_LENGTH) {
    return res.status(400).json({
      error: 'BIO_TOO_LONG',
      message: `bio must be ${MAX_BIO_LENGTH} characters or fewer.`,
    });
  }

  try {
    const [result] = await db.query(
      'UPDATE users SET intro = ? WHERE id = ?',
      [normalizedBio, req.userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    return res.json({ ok: true, bio: normalizedBio });
  } catch (err) {
    console.error('[profile:bio]', err);
    return res.status(500).json({ error: 'BIO_UPDATE_FAILED', message: 'Failed to update bio.' });
  }
});

module.exports = router;
