'use strict';

const { kstYmd } = require('./kstUtils');

const ALLOWED_STATS = ['health', 'social', 'diligence', 'focus', 'creativity'];
const EXP_PER_LEVEL = 1000;
const DAILY_QUEST_STAT_CAP = 70;
const STAT_ORDER_FIRST_EVOLUTION = ['health', 'diligence', 'focus', 'social', 'creativity'];
const LINEAGE_TO_DOMINANT_STAT = {
  fire: 'health',
  water: 'diligence',
  sprout: 'focus',
  cloud: 'social',
  lightning: 'creativity',
};

function maxStatForLevel(level) {
  const lv = Math.max(1, Number(level) || 1);
  return 100 + 100 * Math.floor((lv - 1) / 5);
}

/** 맞춤(LLM) 퀘스트: quests.for_roll_pool = 0 → 코인 미지급 */
function isLlmQuest(quest) {
  return Number(quest.for_roll_pool) === 0;
}

async function ensureStatsRow(conn, userId) {
  await conn.query(
    `INSERT OR IGNORE INTO stats (user_id, health, social, diligence, focus, creativity, daily_fatigue, quest_daily_stat_sum, last_updated_date)
     VALUES (?, 0, 0, 0, 0, 0, 0, 0, NULL)`,
    [userId]
  );
}

async function tryPetEvolutionOnce(conn, userId) {
  const [petRows] = await conn.query(
    `SELECT id, level, evolution_stage, animal_type, lineage_type
     FROM pets WHERE user_id = ? ORDER BY id ASC LIMIT 1`,
    [userId]
  );
  const pet = petRows[0];
  if (!pet) return false;

  const [statsRows] = await conn.query(
    'SELECT health, social, diligence, focus, creativity FROM stats WHERE user_id = ?',
    [userId]
  );
  const st = statsRows[0] || {};

  const petLevel = Number(pet.level) || 1;
  const ev = Number(pet.evolution_stage) || 0;
  const animal = String(pet.animal_type || '');

  if (ev === 0 && animal === 'egg' && petLevel >= 6) {
    for (const statName of STAT_ORDER_FIRST_EVOLUTION) {
      const val = Number(st[statName]) || 0;
      if (val < 100) continue;
      const [rows] = await conn.query(
        'SELECT to_lineage_type, to_animal_type FROM egg_hatch_rules WHERE top_stat_type = ? AND is_active = 1 LIMIT 1',
        [statName]
      );
      if (!rows.length) continue;
      const r = rows[0];
      await conn.query(
        `UPDATE pets SET evolution_stage = 1, animal_type = ?, lineage_type = ?, last_evolved_at = datetime('now') WHERE id = ?`,
        [r.to_animal_type, r.to_lineage_type, pet.id]
      );
      return true;
    }
    return false;
  }

  if (ev === 1 && petLevel >= 11 && pet.lineage_type) {
    const domStat = LINEAGE_TO_DOMINANT_STAT[String(pet.lineage_type)] || null;
    if (!domStat) return false;
    const domVal = Number(st[domStat]) || 0;
    if (domVal < 200) return false;

    const [rows] = await conn.query(
      `SELECT to_animal_type FROM pet_evolution_rules
       WHERE lineage_type = ? AND from_animal_type = ? AND required_stage = ? AND is_active = 1
       ORDER BY priority ASC LIMIT 1`,
      [pet.lineage_type, pet.animal_type, ev]
    );
    if (!rows.length) return false;
    const toType = rows[0].to_animal_type;
    await conn.query(
      `UPDATE pets SET evolution_stage = evolution_stage + 1, animal_type = ?, last_evolved_at = datetime('now') WHERE id = ?`,
      [toType, pet.id]
    );
    return true;
  }

  return false;
}

async function tryPetEvolution(conn, userId) {
  let evolved = false;
  for (let i = 0; i < 2; i += 1) {
    const once = await tryPetEvolutionOnce(conn, userId);
    if (!once) break;
    evolved = true;
  }
  return evolved;
}

/**
 * 퀘스트 보상을 한 트랜잭션 안에서 적용합니다.
 * @returns {Promise<{ exp: number, coin: number, statType: string|null, statAmount: number, fatigue: number, levelUp: boolean, levelUps: number, evolved: boolean }>}
 */
async function applyQuestReward(conn, userId, quest) {
  await ensureStatsRow(conn, userId);

  const kstToday = kstYmd();
  const rewardExp = Number(quest.reward_exp) || 0;
  const rewardCoin = isLlmQuest(quest) ? 0 : Number(quest.reward_coin) || 0;
  const statType = String(quest.reward_stat_type || '').trim();
  const statAmountRaw = Number(quest.reward_stat_amount) || 0;

  const [statsRows] = await conn.query(
    `SELECT health, social, diligence, focus, creativity,
            COALESCE(quest_daily_stat_sum, 0) AS quest_daily_stat_sum,
            COALESCE(last_updated_date, '') AS last_updated_date
     FROM stats WHERE user_id = ?`,
    [userId]
  );
  const st = statsRows[0] || {};

  let questDailySum = Number(st.quest_daily_stat_sum) || 0;
  const lastDate = st.last_updated_date || null;
  if (lastDate !== kstToday) {
    questDailySum = 0;
  }

  const [userRows] = await conn.query('SELECT exp FROM users WHERE id = ?', [userId]);
  let exp = Number(userRows[0]?.exp) || 0;
  exp += rewardExp;

  const [petRows] = await conn.query(
    'SELECT id, level FROM pets WHERE user_id = ? ORDER BY id ASC LIMIT 1',
    [userId]
  );
  const pet = petRows[0];
  let petLevel = pet ? Number(pet.level) || 1 : 1;
  let levelUps = 0;
  while (exp >= EXP_PER_LEVEL) {
    exp -= EXP_PER_LEVEL;
    petLevel += 1;
    levelUps += 1;
  }

  await conn.query('UPDATE users SET exp = ?, coin = coin + ? WHERE id = ?', [exp, rewardCoin, userId]);
  if (pet) {
    await conn.query('UPDATE pets SET level = ? WHERE id = ?', [petLevel, pet.id]);
  }

  const maxStat = maxStatForLevel(petLevel);
  let appliedStat = 0;
  if (ALLOWED_STATS.includes(statType) && statAmountRaw > 0) {
    const currentStat = Number(st[statType]) || 0;
    const roomCap = Math.max(0, maxStat - currentStat);
    const roomDaily = Math.max(0, DAILY_QUEST_STAT_CAP - questDailySum);
    appliedStat = Math.min(statAmountRaw, roomCap, roomDaily);
    questDailySum += appliedStat;
    if (appliedStat > 0) {
      await conn.query(
        `UPDATE stats SET ${statType} = ${statType} + ? WHERE user_id = ?`,
        [appliedStat, userId]
      );
    }
  }

  await conn.query(
    `UPDATE stats SET quest_daily_stat_sum = ?, last_updated_date = ? WHERE user_id = ?`,
    [questDailySum, kstToday, userId]
  );

  const evolved = await tryPetEvolution(conn, userId);

  return {
    exp: rewardExp,
    coin: rewardCoin,
    statType: appliedStat > 0 ? statType : null,
    statAmount: appliedStat,
    fatigue: 0,
    levelUp: levelUps > 0,
    levelUps,
    evolved,
  };
}

module.exports = {
  applyQuestReward,
  ensureStatsRow,
  maxStatForLevel,
  isLlmQuest,
  ALLOWED_STATS,
  EXP_PER_LEVEL,
  DAILY_QUEST_STAT_CAP,
};
