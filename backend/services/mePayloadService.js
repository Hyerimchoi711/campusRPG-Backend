'use strict';

const { questRewardEngine } = require('./questRewardEngine');

class MePayloadService {
  constructor(rewardEngine = questRewardEngine) {
    this._rewardEngine = rewardEngine;
  }

  _formatPetRow(p) {
    return {
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
    };
  }

  async _fetchFirstPet(db, userId) {
    const [pets] = await db.query(
      `SELECT id, name, level, evolution_stage, animal_type, lineage_type, last_evolved_at
       FROM pets WHERE user_id = ? ORDER BY id ASC LIMIT 1`,
      [userId]
    );
    return pets[0] || null;
  }

  _characterLevelFromPet(p) {
    return p ? Number(p.level) || 1 : 1;
  }

  /**
   * GET /api/me 과 동일한 `{ user, pet }` 스냅샷 (Bearer로 식별된 userId 전용).
   * @returns {Promise<{ user: object, pet: object|null }|null>}
   */
  async getMeUserAndPet(db, userId) {
    const [users] = await db.query(
      `SELECT u.id, u.email, u.nickname, u.coin, u.exp, u.student_id, u.major, u.university_name, u.age, u.school_year, u.friend_code, u.intro, u.avatar,
              s.health, s.social, s.diligence, s.focus, s.creativity,
              s.daily_fatigue, COALESCE(s.quest_daily_stat_sum, 0) AS quest_daily_stat_sum,
              s.last_updated_date AS stats_last_updated
       FROM users u
       LEFT JOIN stats s ON s.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );
    if (!users.length) {
      return null;
    }
    const u = users[0];
    const p = await this._fetchFirstPet(db, userId);
    const characterLevel = this._characterLevelFromPet(p);

    return {
      user: {
        id: u.id,
        email: u.email,
        nickname: u.nickname,
        coin: Number(u.coin),
        exp: Number(u.exp),
        level: characterLevel,
        maxStatPerStat: this._rewardEngine.maxStatForLevel(characterLevel),
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
          dailyFatigue: Number(u.quest_daily_stat_sum) || 0,
          lastUpdatedDate: u.stats_last_updated || null,
        },
      },
      pet: p ? this._formatPetRow(p) : null,
    };
  }

  /**
   * GET /api/users/:id 공개 프로필 — 프로필 필드 + user.level + pet (비공개 경제/스탯 제외).
   * @returns {Promise<{ user: object, pet: object|null }|null>}
   */
  async getPublicUserAndPet(db, userId) {
    const [users] = await db.query(
      `SELECT id, nickname, intro, avatar, university_name, major, school_year, age, friend_code
       FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!users.length) {
      return null;
    }
    const u = users[0];
    const p = await this._fetchFirstPet(db, userId);
    const characterLevel = this._characterLevelFromPet(p);

    return {
      user: {
        id: u.id,
        userId: u.id,
        nickname: u.nickname,
        level: characterLevel,
        intro: u.intro,
        avatar: u.avatar,
        universityName: u.university_name,
        university_name: u.university_name,
        major: u.major,
        schoolYear: u.school_year,
        school_year: u.school_year,
        age: u.age,
        friendCode: u.friend_code,
        friend_code: u.friend_code,
      },
      pet: p ? this._formatPetRow(p) : null,
    };
  }
}

const mePayloadService = new MePayloadService();

module.exports = {
  MePayloadService,
  mePayloadService,
  formatPetRow: mePayloadService._formatPetRow.bind(mePayloadService),
  getMeUserAndPet: mePayloadService.getMeUserAndPet.bind(mePayloadService),
  getPublicUserAndPet: mePayloadService.getPublicUserAndPet.bind(mePayloadService),
};
