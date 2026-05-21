'use strict';

class QuestLlmService {
  static DEFAULT_MODEL = 'gemini-2.5-flash';
  static MODEL_ALIASES = {
    'gemini-1.5-flash': QuestLlmService.DEFAULT_MODEL,
    'gemini-1.5-flash-latest': QuestLlmService.DEFAULT_MODEL,
    'gemini-1.5-flash-8b': QuestLlmService.DEFAULT_MODEL,
    'gemini-1.5-pro': QuestLlmService.DEFAULT_MODEL,
    'gemini-1.5-pro-latest': QuestLlmService.DEFAULT_MODEL,
    'gemini-pro': QuestLlmService.DEFAULT_MODEL,
  };
  static ALLOWED_TYPES = new Set(['DAILY', 'WEEKLY']);
  static ALLOWED_STATS = new Set(['health', 'social', 'diligence', 'focus', 'creativity']);
  static REWARD_RANGES = {
    DAILY: { exp: [50, 100], stat: [5, 9] },
    WEEKLY: { exp: [100, 200], stat: [10, 20] },
  };
  static SYSTEM_PROMPT = `You are a Korean campus life RPG quest designer.
Respond with ONLY a JSON object, no markdown.
Shape:
{"quests":[{"title":string,"type":"DAILY"|"WEEKLY","rewardExp":number,"rewardStatType":"health"|"social"|"diligence"|"focus"|"creativity","rewardStatAmount":number}]}
Rules:
- Create exactly 5 DAILY quests and exactly 3 WEEKLY quests.
- Korean only. Realistic campus life: attendance, assignments, library, exercise, clubs, sleep.
- No illegal, violent, sexual, medical treatment, or dangerous content.
- title max 45 Korean characters.
- rewardExp: DAILY 50-100, WEEKLY 100-200 (no coin rewards).
- rewardStatAmount: DAILY 5-8, WEEKLY 10-20.`;

  _geminiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  }

  _geminiModel() {
    const requested = (process.env.GEMINI_MODEL || QuestLlmService.DEFAULT_MODEL).trim();
    return QuestLlmService.MODEL_ALIASES[requested] || requested;
  }

  _clampInt(value, min, max) {
    return Math.min(max, Math.max(min, Math.trunc(value)));
  }

  _unwrapJsonText(text) {
    if (!text || typeof text !== 'string') return '';
    const t = text.trim();
    const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
    return fence ? fence[1].trim() : t;
  }

  _buildUserPrompt({ user, prompt, context }) {
    const contextJson = context && typeof context === 'object'
      ? JSON.stringify(context).slice(0, 2000)
      : '';

    return `학생 정보:
- 닉네임: ${user.nickname || '미입력'}
- 대학: ${user.university_name || '미입력'}
- 학과(전공): ${user.major || '미입력'}
- 학년: ${user.school_year || '미입력'}학년
- 한줄소개: ${user.intro || '미입력'}

사용자 요청:
${prompt || '이 학생에게 맞는 일일/주간 퀘스트를 생성해 주세요.'}

추가 context JSON:
${contextJson || '{}'}

DB에 바로 저장할 수 있도록 지정된 JSON shape만 출력하세요.`;
  }

  async _callGemini({ user, prompt, context, key }) {
    const model = this._geminiModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: QuestLlmService.SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: this._buildUserPrompt({ user, prompt, context }) }] }],
        generationConfig: {
          temperature: 0.65,
          responseMimeType: 'application/json',
        },
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      if (response.status === 429) {
        const err = new Error('GEMINI_RATE_LIMIT');
        err.statusCode = 429;
        throw err;
      }
      throw new Error(`Gemini HTTP ${response.status}: ${raw.slice(0, 320)}`);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('GEMINI_RESPONSE_PARSE_FAILED');
    }

    const block = data.promptFeedback?.blockReason;
    if (block) {
      throw new Error(`GEMINI_REQUEST_BLOCKED:${block}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') || '';
    const jsonStr = this._unwrapJsonText(text);
    if (!jsonStr) {
      throw new Error('EMPTY_LLM_RESPONSE');
    }

    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new Error('LLM_JSON_FORMAT_ERROR');
    }
  }

  _normalizeQuest(input, index) {
    const title = String(input?.title || '').trim();
    const type = String(input?.type || '').trim().toUpperCase();
    const rawExp = input?.rewardExp != null ? input.rewardExp : input?.rewardCoin;
    const rewardExp = Number(rawExp);
    const rewardStatType = String(input?.rewardStatType || '').trim();
    const rewardStatAmount = Number(input?.rewardStatAmount);

    if (!title || title.length > 45) {
      throw new Error(`INVALID_LLM_QUEST_TITLE:${index}`);
    }
    if (!QuestLlmService.ALLOWED_TYPES.has(type)) {
      throw new Error(`INVALID_LLM_QUEST_TYPE:${index}`);
    }
    if (!Number.isFinite(rewardExp)) {
      throw new Error(`INVALID_LLM_QUEST_REWARD_EXP:${index}`);
    }
    if (!QuestLlmService.ALLOWED_STATS.has(rewardStatType)) {
      throw new Error(`INVALID_LLM_QUEST_REWARD_STAT:${index}`);
    }
    if (!Number.isInteger(rewardStatAmount) || rewardStatAmount < 0) {
      throw new Error(`INVALID_LLM_QUEST_REWARD_STAT_AMOUNT:${index}`);
    }

    const ranges = QuestLlmService.REWARD_RANGES[type];
    return {
      title,
      type,
      rewardExp: this._clampInt(rewardExp, ranges.exp[0], ranges.exp[1]),
      rewardStatType,
      rewardStatAmount: this._clampInt(rewardStatAmount, ranges.stat[0], ranges.stat[1]),
    };
  }

  _normalizeGeneratedQuests(payload) {
    const source = Array.isArray(payload?.quests)
      ? payload.quests
      : [
          ...(Array.isArray(payload?.daily) ? payload.daily.map((q) => ({ ...q, type: 'DAILY' })) : []),
          ...(Array.isArray(payload?.weekly) ? payload.weekly.map((q) => ({ ...q, type: 'WEEKLY' })) : []),
        ];

    if (!Array.isArray(source) || source.length === 0) {
      throw new Error('LLM_QUESTS_NOT_FOUND');
    }

    return source.map((q, i) => this._normalizeQuest(q, i));
  }

  _toApiQuest(row) {
    return {
      id: row.id,
      title: row.title,
      description: null,
      type: row.type,
      completed: Boolean(row.is_completed),
      progress: 0,
      coinReward: 0,
      expReward: Number(row.reward_exp) || 0,
      rewardStatType: row.reward_stat_type,
      rewardStatAmount: Number(row.reward_stat_amount) || 0,
      questSource: 'llm',
    };
  }

  isConfigured() {
    return Boolean(this._geminiKey());
  }

  /**
   * @returns {Promise<{ quests: object[] }>}
   */
  async generateQuests(conn, userId, user, prompt, context) {
    const key = this._geminiKey();
    if (!key) {
      const err = new Error('GEMINI_API_KEY_MISSING');
      err.statusCode = 503;
      throw err;
    }

    const generated = await this._callGemini({ user, prompt, context, key });
    const quests = this._normalizeGeneratedQuests(generated);

    await conn.beginTransaction();

    const saved = [];
    for (const quest of quests) {
      const [questResult] = await conn.query(
        `INSERT INTO quests (title, type, reward_exp, reward_coin, reward_stat_type, reward_stat_amount, for_roll_pool)
         VALUES (?, ?, ?, 0, ?, ?, 0)`,
        [
          quest.title,
          quest.type,
          quest.rewardExp,
          quest.rewardStatType,
          quest.rewardStatAmount,
        ]
      );
      const questId = questResult.insertId;
      await conn.query(
        `INSERT INTO user_quests (user_id, quest_id, is_completed, assigned_date)
         VALUES (?, ?, 0, date('now'))`,
        [userId, questId]
      );
      saved.push({
        id: questId,
        title: quest.title,
        type: quest.type,
        is_completed: 0,
        reward_exp: quest.rewardExp,
        reward_coin: 0,
        reward_stat_type: quest.rewardStatType,
        reward_stat_amount: quest.rewardStatAmount,
      });
    }

    await conn.commit();
    return { quests: saved.map((row) => this._toApiQuest(row)) };
  }
}

const questLlmService = new QuestLlmService();

module.exports = {
  QuestLlmService,
  questLlmService,
};
