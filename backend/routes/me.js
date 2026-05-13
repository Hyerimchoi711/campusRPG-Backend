const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getMeUserAndPet } = require('../services/mePayloadService');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const payload = await getMeUserAndPet(db, req.userId);
    if (!payload) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
