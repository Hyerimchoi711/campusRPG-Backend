const express = require('express');
const db = require('../db');

const router = express.Router();

/** GET / — 목록: id, title, imageUrl, linkUrl, createdAt */
router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         id,
         title,
         image_url AS imageUrl,
         link_url AS linkUrl,
         created_at AS createdAt
       FROM events
       ORDER BY datetime(created_at) DESC, id DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'EVENTS_FETCH_FAILED', message: '이벤트 목록 조회에 실패했습니다.' });
  }
});

module.exports = router;
