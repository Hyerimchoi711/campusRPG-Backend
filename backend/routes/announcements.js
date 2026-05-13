const express = require('express');
const db = require('../db');

const router = express.Router();

/** GET / — 목록: id, title, createdAt */
router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, created_at AS createdAt
       FROM announcements
       ORDER BY datetime(created_at) DESC, id DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'ANNOUNCEMENTS_FETCH_FAILED', message: '공지 목록 조회에 실패했습니다.' });
  }
});

/** GET /:id — 상세 */
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'INVALID_ANNOUNCEMENT_ID', message: '유효한 공지 ID가 필요합니다.' });
  }
  try {
    const [rows] = await db.query(
      `SELECT id, title, content, created_at AS createdAt
       FROM announcements
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'ANNOUNCEMENT_NOT_FOUND', message: '공지를 찾을 수 없습니다.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'ANNOUNCEMENT_FETCH_FAILED', message: '공지 조회에 실패했습니다.' });
  }
});

module.exports = router;
