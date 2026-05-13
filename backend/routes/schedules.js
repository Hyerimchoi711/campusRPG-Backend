const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_EXP_REWARD = 50;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toApiSchedule(row) {
  return {
    id: row.id,
    title: row.content,
    description: null,
    scheduledDate: row.target_date,
    completed: Boolean(row.is_completed),
    expReward: Number(row.reward_exp) || 0,
  };
}

router.get('/', requireAuth, async (req, res) => {
  const date = req.query?.date;
  const from = req.query?.from;
  const to = req.query?.to;

  if (date != null && !isIsoDate(date)) {
    return res.status(400).json({ error: 'INVALID_DATE' });
  }
  if (from != null && !isIsoDate(from)) {
    return res.status(400).json({ error: 'INVALID_FROM_DATE' });
  }
  if (to != null && !isIsoDate(to)) {
    return res.status(400).json({ error: 'INVALID_TO_DATE' });
  }
  if (date != null && (from != null || to != null)) {
    return res.status(400).json({ error: 'INVALID_DATE_FILTER' });
  }
  if (from != null && to != null && from > to) {
    return res.status(400).json({ error: 'INVALID_DATE_RANGE' });
  }

  const where = ['user_id = ?'];
  const params = [req.userId];

  if (date != null) {
    where.push('target_date = ?');
    params.push(date);
  } else {
    if (from != null) {
      where.push('target_date >= ?');
      params.push(from);
    }
    if (to != null) {
      where.push('target_date <= ?');
      params.push(to);
    }
  }

  try {
    const [rows] = await db.query(
      `SELECT id, content, target_date, is_completed, reward_exp
       FROM schedules
       WHERE ${where.join(' AND ')}
       ORDER BY target_date ASC, id ASC`,
      params
    );
    return res.json(rows.map(toApiSchedule));
  } catch (err) {
    console.error('[schedules] GET /schedules', err);
    return res.status(500).json({ error: 'SCHEDULES_FETCH_FAILED' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const rawTitle =
    typeof req.body?.title === 'string'
      ? req.body.title
      : typeof req.body?.content === 'string'
        ? req.body.content
        : '';
  const title = rawTitle.trim();
  const scheduledDate =
    typeof req.body?.scheduledDate === 'string'
      ? req.body.scheduledDate
      : typeof req.body?.targetDate === 'string'
        ? req.body.targetDate
        : typeof req.body?.target_date === 'string'
          ? req.body.target_date
          : '';
  const expReward =
    req.body?.expReward == null
      ? DEFAULT_EXP_REWARD
      : Number(req.body.expReward);

  if (!title) {
    return res.status(400).json({ error: 'INVALID_TITLE' });
  }
  if (!isIsoDate(scheduledDate)) {
    return res.status(400).json({ error: 'INVALID_SCHEDULED_DATE' });
  }
  if (!Number.isInteger(expReward) || expReward < 0) {
    return res.status(400).json({ error: 'INVALID_EXP_REWARD' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO schedules (user_id, content, target_date, reward_exp)
       VALUES (?, ?, ?, ?)`,
      [req.userId, title, scheduledDate, expReward]
    );
    const [rows] = await db.query(
      `SELECT id, content, target_date, is_completed, reward_exp
       FROM schedules
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [result.insertId, req.userId]
    );

    return res.status(201).json({ schedule: toApiSchedule(rows[0]) });
  } catch (err) {
    console.error('[schedules] POST /schedules', err);
    return res.status(500).json({ error: 'SCHEDULE_CREATE_FAILED' });
  }
});

router.post('/:id/complete', requireAuth, async (req, res) => {
  const scheduleId = Number(req.params.id);
  if (!Number.isInteger(scheduleId) || scheduleId < 1) {
    return res.status(400).json({ error: 'INVALID_SCHEDULE_ID' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[schedule]] = await conn.query(
      `SELECT id, content, target_date, is_completed, reward_exp
       FROM schedules
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [scheduleId, req.userId]
    );

    if (!schedule) {
      await conn.rollback();
      return res.status(404).json({ error: 'SCHEDULE_NOT_FOUND' });
    }
    if (schedule.is_completed) {
      await conn.rollback();
      return res.status(409).json({ error: 'SCHEDULE_ALREADY_COMPLETED' });
    }

    const expGained = Number(schedule.reward_exp) || 0;
    await conn.query(
      'UPDATE schedules SET is_completed = 1 WHERE id = ? AND user_id = ?',
      [scheduleId, req.userId]
    );
    await conn.query(
      'UPDATE users SET exp = exp + ? WHERE id = ?',
      [expGained, req.userId]
    );

    await conn.commit();

    return res.json({
      ok: true,
      expGained,
      schedule: toApiSchedule({
        ...schedule,
        is_completed: 1,
      }),
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // Ignore rollback errors when the transaction was already closed.
    }
    console.error('[schedules] POST /schedules/:id/complete', err);
    return res.status(500).json({ error: 'SCHEDULE_COMPLETE_FAILED' });
  } finally {
    conn.release();
  }
});

module.exports = router;
