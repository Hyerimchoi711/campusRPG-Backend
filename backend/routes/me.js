const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.email, u.nickname, u.coin, u.exp, u.student_id, u.major, u.university_name, u.age, u.school_year, u.friend_code, u.intro, u.avatar,
              s.health, s.social, s.diligence, s.focus, s.creativity, s.daily_fatigue, s.last_updated_date AS stats_last_updated
       FROM users u
       LEFT JOIN stats s ON s.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
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
        coin: Number(u.coin),
        exp: Number(u.exp),
        studentId: u.student_id,
        major: u.major,
        universityName: u.university_name,
        age: u.age,
        schoolYear: u.school_year,
        school_year: u.school_year,
        friendCode: u.friend_code,
        intro: u.intro,
        avatar: u.avatar,
        stats: {
          health: Number(u.health) || 0,
          social: Number(u.social) || 0,
          diligence: Number(u.diligence) || 0,
          focus: Number(u.focus) || 0,
          creativity: Number(u.creativity) || 0,
          dailyFatigue: Number(u.daily_fatigue) || 0,
          lastUpdatedDate: u.stats_last_updated || null,
        },
      },
      pet: p
        ? {
            id: p.id,
            name: p.name,
            level: p.level,
            evolutionStage: p.evolution_stage,
            evolution_stage: p.evolution_stage,
            animalType: p.animal_type,
            animal_type: p.animal_type,
            lineageType: p.lineage_type,
            lineage_type: p.lineage_type,
            lastEvolvedAt: p.last_evolved_at,
            last_evolved_at: p.last_evolved_at,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
