const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getPublicUserAndPet } = require('../services/mePayloadService');

const router = express.Router();

async function canViewProfile(viewerId, targetId) {
  if (viewerId === targetId) {
    return true;
  }
  const [rows] = await db.query(
    `SELECT 1 AS ok FROM friendships
     WHERE (user_id = ? AND friend_user_id = ?)
        OR (user_id = ? AND friend_user_id = ?)
     LIMIT 1`,
    [viewerId, targetId, targetId, viewerId]
  );
  return rows.length > 0;
}

router.get('/:userId', requireAuth, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: 'INVALID_USER_ID', message: '유효한 사용자 ID가 필요합니다.' });
  }

  try {
    if (!(await canViewProfile(req.userId, userId))) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: '친구이거나 본인만 프로필을 조회할 수 있습니다.',
      });
    }

    const payload = await getPublicUserAndPet(db, userId);
    if (!payload) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
    }

    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'USER_FETCH_FAILED', message: '사용자 조회에 실패했습니다.' });
  }
});

module.exports = router;
