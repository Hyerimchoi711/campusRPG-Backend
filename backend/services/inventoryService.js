'use strict';

const { kstDateService } = require('./kstUtils');
const { questRewardEngine } = require('./questRewardEngine');

class InventoryUseError extends Error {
  constructor(status, error, message) {
    super(message || error);
    this.status = status;
    this.code = error;
  }
}

class InventoryService {
  static FATIGUE_RECOVERY_AMOUNT = 10;
  static NO_STAT_EFFECT_TYPES = new Set([
    'EXP_BOOST',
    'STAT_BOOST',
    'STAT_RESET',
    'NAME_CHANGE',
    'RANDOM_STAT',
  ]);

  static INVENTORY_LIST_SQL = `
    SELECT
      ui.id AS id,
      ui.item_id AS itemId,
      ui.quantity,
      i.name,
      i.description,
      i.price,
      i.image_url AS imageUrl,
      i.icon_emoji AS iconEmoji,
      i.effect_type AS effectType
    FROM user_inventory ui
    INNER JOIN items i ON i.id = ui.item_id
    WHERE ui.user_id = ?
    ORDER BY ui.id ASC
  `;

  constructor(kstService = kstDateService, rewardEngine = questRewardEngine) {
    this._kst = kstService;
    this._rewardEngine = rewardEngine;
  }

  _mapInventoryRow(row) {
    return {
      id: row.id,
      itemId: row.itemId,
      quantity: Number(row.quantity) || 0,
      name: row.name,
      description: row.description,
      price: Number(row.price) || 0,
      imageUrl: row.imageUrl,
      iconEmoji: row.iconEmoji,
      effectType: row.effectType,
    };
  }

  async listInventory(conn, userId) {
    const [rows] = await conn.query(InventoryService.INVENTORY_LIST_SQL, [userId]);
    return rows.map((row) => this._mapInventoryRow(row));
  }

  _useMessage(itemName) {
    const name = String(itemName || '아이템').trim();
    const hasJong = name.length > 0 && (name.charCodeAt(name.length - 1) - 0xac00) % 28 !== 0;
    const particle = hasJong ? '을' : '를';
    return `${name}${particle} 사용했습니다.`;
  }

  async _applyFatigueRecovery(conn, userId) {
    const kstToday = this._kst.kstYmd();
    const [statsRows] = await conn.query(
      `SELECT COALESCE(quest_daily_stat_sum, 0) AS quest_daily_stat_sum,
              COALESCE(last_updated_date, '') AS last_updated_date
       FROM stats WHERE user_id = ?`,
      [userId]
    );
    const st = statsRows[0] || {};
    let questDailySum = Number(st.quest_daily_stat_sum) || 0;
    if (st.last_updated_date !== kstToday) {
      questDailySum = 0;
    }
    const before = questDailySum;
    const reduction = Math.min(InventoryService.FATIGUE_RECOVERY_AMOUNT, before);
    questDailySum = Math.max(0, before - InventoryService.FATIGUE_RECOVERY_AMOUNT);

    await conn.query(
      `UPDATE stats
       SET quest_daily_stat_sum = ?, last_updated_date = ?
       WHERE user_id = ?`,
      [questDailySum, kstToday, userId]
    );

    return reduction > 0 ? -reduction : 0;
  }

  /**
   * @returns {Promise<{ message: string, effects: object, inventory: object[] }>}
   */
  async useInventoryEntry(conn, userId, inventoryEntryId) {
    await this._rewardEngine.ensureStatsRow(conn, userId);

    const [rows] = await conn.query(
      `SELECT
         ui.id,
         ui.quantity,
         ui.item_id,
         i.name,
         i.effect_type
       FROM user_inventory ui
       INNER JOIN items i ON i.id = ui.item_id
       WHERE ui.id = ? AND ui.user_id = ?
       LIMIT 1`,
      [inventoryEntryId, userId]
    );
    const entry = rows[0];

    if (!entry) {
      throw new InventoryUseError(404, 'INVENTORY_ENTRY_NOT_FOUND', '인벤토리 항목을 찾을 수 없습니다.');
    }

    const quantity = Number(entry.quantity) || 0;
    if (quantity <= 0) {
      throw new InventoryUseError(409, 'INSUFFICIENT_QUANTITY', '사용 가능한 수량이 없습니다.');
    }

    const effectType = String(entry.effect_type || '').trim();
    const effects = { coin: 0, exp: 0 };

    if (effectType === 'FATIGUE_RECOVERY') {
      const fatigueDelta = await this._applyFatigueRecovery(conn, userId);
      if (fatigueDelta !== 0) {
        effects.fatigueDelta = fatigueDelta;
      }
    } else if (effectType && !InventoryService.NO_STAT_EFFECT_TYPES.has(effectType)) {
      throw new InventoryUseError(400, 'ITEM_NOT_USABLE', '사용할 수 없는 아이템입니다.');
    }

    if (quantity > 1) {
      await conn.query(
        `UPDATE user_inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [quantity - 1, inventoryEntryId]
      );
    } else {
      await conn.query('DELETE FROM user_inventory WHERE id = ?', [inventoryEntryId]);
    }

    const inventory = await this.listInventory(conn, userId);

    return {
      message: this._useMessage(entry.name),
      effects,
      inventory,
    };
  }
}

const inventoryService = new InventoryService();

module.exports = {
  InventoryService,
  InventoryUseError,
  inventoryService,
  listInventory: inventoryService.listInventory.bind(inventoryService),
  useInventoryEntry: inventoryService.useInventoryEntry.bind(inventoryService),
  mapInventoryRow: inventoryService._mapInventoryRow.bind(inventoryService),
  FATIGUE_RECOVERY_AMOUNT: InventoryService.FATIGUE_RECOVERY_AMOUNT,
};
