const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getMeUserAndPet } = require('../services/mePayloadService');
const { kstYmd } = require('../services/kstUtils');

const router = express.Router();

const TODO_COMPLETION_REWARD_COIN = 100;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeClientTodoId(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  const s = String(raw).trim();
  return s.length ? s : null;
}

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

/** 투두 완료 보너스 코인 (+100, KST 당일·멱등) — 프론트 `fetchRpgJsonAuth` */
router.post('/todo-completion-reward', requireAuth, async (req, res) => {
  const dateKey = req.body?.dateKey;
  const clientTodoId = normalizeClientTodoId(req.body?.clientTodoId);

  if (typeof dateKey !== 'string' || !DATE_KEY_RE.test(dateKey.trim())) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: 'dateKey는 YYYY-MM-DD 형식의 문자열이어야 합니다.',
    });
  }
  if (clientTodoId == null) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: 'clientTodoId는 숫자 또는 비어 있지 않은 문자열이어야 합니다.',
    });
  }

  const dk = dateKey.trim();
  const todayKst = kstYmd();
  if (dk !== todayKst) {
    return res.status(400).json({
      error: 'NOT_TODAY',
      message: 'dateKey가 서버 기준 오늘(KST)과 일치하지 않습니다.',
    });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [insMeta] = await conn.query(
      `INSERT OR IGNORE INTO todo_completion_reward_claims (user_id, date_key, client_todo_id)
       VALUES (?, ?, ?)`,
      [req.userId, dk, clientTodoId]
    );
    const inserted = Number(insMeta?.changes) > 0;

    if (inserted) {
      await conn.query('UPDATE users SET coin = coin + ? WHERE id = ?', [TODO_COMPLETION_REWARD_COIN, req.userId]);
    }

    const [coinRows] = await conn.query('SELECT coin FROM users WHERE id = ?', [req.userId]);
    if (!coinRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
    }

    await conn.commit();

    const coin = Number(coinRows[0].coin) || 0;
    if (inserted) {
      return res.status(200).json({
        awarded: true,
        coin,
        amount: TODO_COMPLETION_REWARD_COIN,
      });
    }
    return res.status(200).json({
      awarded: false,
      coin,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    console.error('[me] POST /todo-completion-reward', err);
    return res.status(500).json({ error: 'TODO_REWARD_FAILED', message: '보너스 처리에 실패했습니다.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
