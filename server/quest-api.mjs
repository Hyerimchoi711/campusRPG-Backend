/**
 * LLM으로 일일/주간 퀘스트 JSON 생성 (Google Gemini — AI Studio 무료 할당량)
 * 실행: cd server && npm install && npm start
 * 헬스: http://localhost:8787/api/health (hasKey 등) — Vite(5173)/api/health 는 backend(5000)로 연결됨
 * 환경: server/.env → GEMINI_API_KEY=...  (또는 GOOGLE_API_KEY)
 * GEMINI_MODEL: 기본 gemini-2.5-flash (gemini-1.5-flash 등 구 모델은 API에서 404 → 자동 치환)
 * 키 발급: https://aistudio.google.com/apikey
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = Number(process.env.QUEST_API_PORT) || 8787;

function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function createCors() {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw == null || String(raw).trim() === '') {
    return cors({ origin: true, credentials: true });
  }
  const list = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      cb(null, list.includes(origin));
    },
    credentials: true,
  });
}

app.use(createCors());
app.use(express.json({ limit: '48kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    provider: 'gemini',
    hasKey: Boolean(geminiKey()),
  });
});

const SYSTEM_PROMPT = `You are a Korean campus life RPG quest designer.
Respond with ONLY a JSON object (no markdown) with this exact shape:
{"daily":[...5 items...],"weekly":[...3 items...]}
Each item: { "title": string, "reward": string }
- daily: exactly 5 quests doable in one day
- weekly: exactly 3 quests for one week
- Korean only. Realistic student life (attendance, assignments, library, exercise, clubs, sleep).
- No illegal, violent, sexual, or medical treatment content.
- title max 45 characters, reward max 40 characters.
- reward must include coin text like "+80 코인" and may add a stat like "· 집중력 +1".`;

function unwrapJsonText(text) {
  if (!text || typeof text !== 'string') return '';
  const t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) return fence[1].trim();
  return t;
}

async function callGemini({ major, schoolYear, university, realName, key }) {
  const userMsg = `학생 정보:
- 이름: ${realName || '미입력'}
- 대학: ${university || '미입력'}
- 학과(전공): ${major || '미입력'}
- 학년: ${schoolYear || '미입력'} (숫자만 있으면 N학년으로 해석)

위 학생에게 맞춘 일일 5개, 주간 3개 퀘스트를 JSON으로 출력하세요.`;

  const DEFAULT_MODEL = 'gemini-2.5-flash';
  /** AI Studio v1beta 에서 사라진/변경된 이름 → 현재 쓸 수 있는 모델로 치환 */
  const MODEL_ALIASES = {
    'gemini-1.5-flash': DEFAULT_MODEL,
    'gemini-1.5-flash-latest': DEFAULT_MODEL,
    'gemini-1.5-flash-8b': DEFAULT_MODEL,
    'gemini-1.5-pro': DEFAULT_MODEL,
    'gemini-1.5-pro-latest': DEFAULT_MODEL,
    'gemini-pro': DEFAULT_MODEL,
  };
  const requested = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const model = MODEL_ALIASES[requested] || requested;
  if (MODEL_ALIASES[requested]) {
    console.warn(
      `[quest-api] GEMINI_MODEL="${requested}" 는 generateContent 에서 더 이상 쓰이지 않아 "${model}" 로 요청합니다. server/.env 를 업데이트해 주세요.`
    );
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userMsg }] }],
      generationConfig: {
        temperature: 0.65,
        responseMimeType: 'application/json',
      },
    }),
  });

  const raw = await r.text();
  if (!r.ok) {
    if (r.status === 429) {
      const err = new Error('GEMINI_RATE_LIMIT');
      err.statusCode = 429;
      throw err;
    }
    throw new Error(`Gemini HTTP ${r.status}: ${raw.slice(0, 320)}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Gemini 응답 JSON 파싱 실패');
  }

  const block = data.promptFeedback?.blockReason;
  if (block) {
    throw new Error(`Gemini 요청 차단: ${block}`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('Gemini 후보 응답 없음');
  }

  const parts = candidate.content?.parts;
  const text = parts?.map((p) => p.text).join('') || '';
  const jsonStr = unwrapJsonText(text);
  if (!jsonStr) {
    throw new Error('빈 LLM 응답');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('LLM JSON 형식 오류');
  }

  if (!Array.isArray(parsed.daily) || !Array.isArray(parsed.weekly)) {
    throw new Error('daily/weekly 배열이 없습니다');
  }

  return parsed;
}

app.post('/api/quests/generate', async (req, res) => {
  try {
    const key = geminiKey();
    if (!key) {
      return res.status(503).json({
        error:
          'GEMINI_API_KEY가 없습니다. Google AI Studio(https://aistudio.google.com/apikey)에서 키를 발급해 server/.env 에 넣고 `cd server && npm start` 하세요. (GOOGLE_API_KEY 이름도 가능)',
      });
    }

    const { major, schoolYear, university, realName } = req.body || {};
    const payload = await callGemini({ major, schoolYear, university, realName, key });
    return res.json(payload);
  } catch (e) {
    console.error('[quest-api]', e);
    if (e.statusCode === 429 || e.message === 'GEMINI_RATE_LIMIT') {
      return res.status(429).json({
        error:
          'Gemini 무료 할당량(분당·일당 요청 한도)을 초과했습니다. 잠시 후 다시 시도하거나, 다른 Google 계정/API 키·유료 플랜을 검토해 보세요. 안내: https://ai.google.dev/gemini-api/docs/rate-limits',
      });
    }
    return res.status(500).json({ error: e.message || '퀘스트 생성 실패' });
  }
});

app.listen(PORT, () => {
  console.log(`[quest-api] Gemini · http://localhost:${PORT}  (POST /api/quests/generate)`);
});
