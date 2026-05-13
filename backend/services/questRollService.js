'use strict';

const { kstYmd, kstMondayYmd } = require('./kstUtils');
const { applyQuestReward, ensureStatsRow } = require('./questRewardEngine');
const { getMeUserAndPet } = require('./mePayloadService');

const ALLOWED_STATS = ['health', 'social', 'diligence', 'focus', 'creativity'];

function pickRandom(arr) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function groupByStat(rows) {
  const m = new Map();
  for (const s of ALLOWED_STATS) m.set(s, []);
  for (const r of rows) {
    const st = String(r.reward_stat_type || '').trim();
    if (m.has(st)) m.get(st).push(r);
  }
  return m;
}

function rollDailyQuestIds(poolDaily) {
  const byStat = groupByStat(poolDaily);
  const ids = [];
  for (const st of ALLOWED_STATS) {
    const pool = byStat.get(st);
    const choice = pickRandom(pool);
    if (!choice) {
      throw new Error(`DAILY_POOL_MISSING_STAT:${st}`);
    }
    ids.push(choice.id);
  }
  return ids;
}

function rollWeeklyQuestIds(poolWeekly) {
  const stats = shuffleArray([...ALLOWED_STATS]).slice(0, 3);
  const byStat = groupByStat(poolWeekly);
  const ids = [];
  for (const st of stats) {
    const pool = byStat.get(st);
    const choice = pickRandom(pool);
    if (!choice) {
      throw new Error(`WEEKLY_POOL_MISSING_STAT:${st}`);
    }
    ids.push(choice.id);
  }
  return ids;
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mapRollRow(r) {
  return {
    assignmentId: r.id,
    slot: r.slot,
    questId: r.quest_id,
    title: r.title,
    rewardExp: Number(r.reward_exp) || 0,
    rewardCoin: Number(r.reward_coin) || 0,
    rewardStatType: r.reward_stat_type,
    rewardStatAmount: Number(r.reward_stat_amount) || 0,
    completed: Boolean(r.completed),
    rewardGrantedThisSlot: Boolean(r.reward_granted_this_slot),
    questSource: r.quest_source || 'default',
  };
}

async function fetchTemplatePool(conn) {
  const [rows] = await conn.query(
    `SELECT id, title, type, reward_exp, reward_coin, reward_stat_type, reward_stat_amount
     FROM quests
     WHERE for_roll_pool = 1 AND type IN ('DAILY', 'WEEKLY')`
  );
  return rows;
}

async function replaceDailyRoll(conn, userId, rollDate, questIds) {
  await conn.query('DELETE FROM user_daily_quest_roll WHERE user_id = ? AND roll_date = ?', [userId, rollDate]);
  for (let slot = 0; slot < questIds.length; slot += 1) {
    await conn.query(
      `INSERT INTO user_daily_quest_roll (user_id, roll_date, slot, quest_id, completed, reward_granted_this_slot, quest_source)
       VALUES (?, ?, ?, ?, 0, 0, 'default')`,
      [userId, rollDate, slot, questIds[slot]]
    );
  }
}

async function replaceWeeklyRoll(conn, userId, weekId, questIds) {
  await conn.query('DELETE FROM user_weekly_quest_roll WHERE user_id = ? AND week_id = ?', [userId, weekId]);
  for (let slot = 0; slot < questIds.length; slot += 1) {
    await conn.query(
      `INSERT INTO user_weekly_quest_roll (user_id, week_id, slot, quest_id, completed, reward_granted_this_slot, quest_source)
       VALUES (?, ?, ?, ?, 0, 0, 'default')`,
      [userId, weekId, slot, questIds[slot]]
    );
  }
}

async function ensureRollsForUser(conn, userId) {
  const rollDate = kstYmd();
  const weekId = kstMondayYmd(rollDate);
  const pool = await fetchTemplatePool(conn);
  const dailyPool = pool.filter((q) => q.type === 'DAILY');
  const weeklyPool = pool.filter((q) => q.type === 'WEEKLY');

  const [dRows] = await conn.query(
    'SELECT COUNT(*) AS c FROM user_daily_quest_roll WHERE user_id = ? AND roll_date = ?',
    [userId, rollDate]
  );
  if (Number(dRows[0]?.c) !== 5) {
    const ids = rollDailyQuestIds(dailyPool);
    await replaceDailyRoll(conn, userId, rollDate, ids);
  }

  const [wRows] = await conn.query(
    'SELECT COUNT(*) AS c FROM user_weekly_quest_roll WHERE user_id = ? AND week_id = ?',
    [userId, weekId]
  );
  if (Number(wRows[0]?.c) !== 3) {
    const ids = rollWeeklyQuestIds(weeklyPool);
    await replaceWeeklyRoll(conn, userId, weekId, ids);
  }

  return { rollDate, weekId };
}

async function selectDailyWithQuests(conn, userId, rollDate) {
  const [rows] = await conn.query(
    `SELECT
       r.id,
       r.slot,
       r.quest_id,
       r.completed,
       r.reward_granted_this_slot,
       r.quest_source,
       q.title,
       q.reward_exp,
       q.reward_coin,
       q.reward_stat_type,
       q.reward_stat_amount
     FROM user_daily_quest_roll r
     INNER JOIN quests q ON q.id = r.quest_id
     WHERE r.user_id = ? AND r.roll_date = ?
     ORDER BY r.slot ASC`,
    [userId, rollDate]
  );
  return rows;
}

async function selectWeeklyWithQuests(conn, userId, weekId) {
  const [rows] = await conn.query(
    `SELECT
       r.id,
       r.slot,
       r.quest_id,
       r.completed,
       r.reward_granted_this_slot,
       r.quest_source,
       q.title,
       q.reward_exp,
       q.reward_coin,
       q.reward_stat_type,
       q.reward_stat_amount
     FROM user_weekly_quest_roll r
     INNER JOIN quests q ON q.id = r.quest_id
     WHERE r.user_id = ? AND r.week_id = ?
     ORDER BY r.slot ASC`,
    [userId, weekId]
  );
  return rows;
}

async function getCurrentQuestSet(db, userId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureStatsRow(conn, userId);
    const { rollDate, weekId } = await ensureRollsForUser(conn, userId);
    const dailyRows = await selectDailyWithQuests(conn, userId, rollDate);
    const weeklyRows = await selectWeeklyWithQuests(conn, userId, weekId);
    await conn.commit();
    return {
      rollDate,
      weekId,
      daily: dailyRows.map(mapRollRow),
      weekly: weeklyRows.map(mapRollRow),
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function patchDailySlot(db, userId, slot, completed) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 4) {
    return { status: 400, body: { error: 'INVALID_SLOT', message: '일일 슬롯은 0~4입니다.' } };
  }
  const rollDate = kstYmd();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureRollsForUser(conn, userId);
    const [rows] = await conn.query(
      `SELECT r.id, r.completed, r.reward_granted_this_slot,
              q.reward_exp, q.reward_coin, q.reward_stat_type, q.reward_stat_amount
       FROM user_daily_quest_roll r
       INNER JOIN quests q ON q.id = r.quest_id
       WHERE r.user_id = ? AND r.roll_date = ? AND r.slot = ?
       LIMIT 1`,
      [userId, rollDate, slot]
    );
    if (!rows.length) {
      await conn.rollback();
      return { status: 404, body: { error: 'SLOT_NOT_FOUND', message: '해당 슬롯의 일일 퀘스트가 없습니다.' } };
    }
    const row = rows[0];
    let rewards = null;
    let levelUp = false;
    let evolved = false;

    if (completed) {
      if (!row.completed) {
        await conn.query('UPDATE user_daily_quest_roll SET completed = 1 WHERE id = ?', [row.id]);
        if (!row.reward_granted_this_slot) {
          const r = await applyQuestReward(conn, userId, row);
          levelUp = r.levelUp;
          evolved = r.evolved;
          rewards = {
            exp: r.exp,
            coin: r.coin,
            statType: r.statType,
            statAmount: r.statAmount,
            fatigue: r.fatigue,
          };
          await conn.query('UPDATE user_daily_quest_roll SET reward_granted_this_slot = 1 WHERE id = ?', [row.id]);
        }
      }
    } else {
      await conn.query('UPDATE user_daily_quest_roll SET completed = 0 WHERE id = ?', [row.id]);
    }

    await conn.commit();
    const fresh = await getCurrentQuestSet(db, userId);
    const snap = await getMeUserAndPet(db, userId);
    return {
      status: 200,
      body: {
        ok: true,
        rewards,
        levelUp,
        evolved,
        rollDate: fresh.rollDate,
        weekId: fresh.weekId,
        rollWeek: fresh.weekId,
        daily: fresh.daily,
        weekly: fresh.weekly,
        user: snap ? snap.user : null,
        pet: snap ? snap.pet : null,
      },
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function patchWeeklySlot(db, userId, slot, completed) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) {
    return { status: 400, body: { error: 'INVALID_SLOT', message: '주간 슬롯은 0~2입니다.' } };
  }
  const rollDate = kstYmd();
  const weekId = kstMondayYmd(rollDate);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureRollsForUser(conn, userId);
    const [rows] = await conn.query(
      `SELECT r.id, r.completed, r.reward_granted_this_slot,
              q.reward_exp, q.reward_coin, q.reward_stat_type, q.reward_stat_amount
       FROM user_weekly_quest_roll r
       INNER JOIN quests q ON q.id = r.quest_id
       WHERE r.user_id = ? AND r.week_id = ? AND r.slot = ?
       LIMIT 1`,
      [userId, weekId, slot]
    );
    if (!rows.length) {
      await conn.rollback();
      return { status: 404, body: { error: 'SLOT_NOT_FOUND', message: '해당 슬롯의 주간 퀘스트가 없습니다.' } };
    }
    const row = rows[0];
    let rewards = null;
    let levelUp = false;
    let evolved = false;

    if (completed) {
      if (!row.completed) {
        await conn.query('UPDATE user_weekly_quest_roll SET completed = 1 WHERE id = ?', [row.id]);
        if (!row.reward_granted_this_slot) {
          const r = await applyQuestReward(conn, userId, row);
          levelUp = r.levelUp;
          evolved = r.evolved;
          rewards = {
            exp: r.exp,
            coin: r.coin,
            statType: r.statType,
            statAmount: r.statAmount,
            fatigue: r.fatigue,
          };
          await conn.query('UPDATE user_weekly_quest_roll SET reward_granted_this_slot = 1 WHERE id = ?', [row.id]);
        }
      }
    } else {
      await conn.query('UPDATE user_weekly_quest_roll SET completed = 0 WHERE id = ?', [row.id]);
    }

    await conn.commit();
    const fresh = await getCurrentQuestSet(db, userId);
    const snap = await getMeUserAndPet(db, userId);
    return {
      status: 200,
      body: {
        ok: true,
        rewards,
        levelUp,
        evolved,
        rollDate: fresh.rollDate,
        weekId: fresh.weekId,
        rollWeek: fresh.weekId,
        daily: fresh.daily,
        weekly: fresh.weekly,
        user: snap ? snap.user : null,
        pet: snap ? snap.pet : null,
      },
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  kstYmd,
  kstMondayYmd,
  getCurrentQuestSet,
  patchDailySlot,
  patchWeeklySlot,
  ALLOWED_STATS,
};
