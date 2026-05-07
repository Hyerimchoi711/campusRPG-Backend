const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:userId', requireAuth, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: 'INVALID_USER_ID', message: '유효한 사용자 ID가 필요합니다.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT
         id,
         nickname,
         intro,
         avatar,
         university_name,
         major,
         school_year,
         age,
         friend_code
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
    }
    const u = rows[0];
    return res.json({
      user: {
        id: u.id,
        userId: u.id,
        nickname: u.nickname,
        intro: u.intro,
        avatar: u.avatar,
        universityName: u.university_name,
        university_name: u.university_name,
        major: u.major,
        schoolYear: u.school_year,
        school_year: u.school_year,
        age: u.age,
        friendCode: u.friend_code,
        friend_code: u.friend_code,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'USER_FETCH_FAILED', message: '사용자 조회에 실패했습니다.' });
  }
});

module.exports = router;
