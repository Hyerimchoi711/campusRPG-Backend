const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, email, nickname, coin, exp, student_id, major, university_name, age, school_year, friend_code, intro, avatar
       FROM users WHERE id = ? LIMIT 1`,
      [req.userId]
    );
    if (!users.length) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    const u = users[0];
    const [pets] = await db.query(
      `SELECT id, name, level, evolution_stage, animal_type, lineage_type, last_evolved_at
       FROM pets WHERE user_id = ? ORDER BY id ASC LIMIT 1`,
      [req.userId]
    );
    const p = pets[0] || null;

    return res.json({
      user: {
        id: u.id,
        email: u.email,
        nickname: u.nickname,
        coin: u.coin,
        exp: u.exp,
        studentId: u.student_id,
        major: u.major,
        universityName: u.university_name,
        age: u.age,
        schoolYear: u.school_year,
        school_year: u.school_year,
        friendCode: u.friend_code,
        intro: u.intro,
        avatar: u.avatar,
      },
      pet: p
        ? {
            id: p.id,
            name: p.name,
            level: p.level,
            evolutionStage: p.evolution_stage,
            animalType: p.animal_type,
            lineageType: p.lineage_type,
            lastEvolvedAt: p.last_evolved_at,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
