# Quest LLM API

프론트(`npm run dev`)와 함께 켜 두면 퀘스트 탭에서 **맞춤 퀘스트 생성**이 동작합니다.

백엔드는 **Google Gemini**(AI Studio **무료 할당량**)를 사용합니다. OpenAI 키는 필요 없습니다.

## 설정

1. 이 폴더에서 의존성 설치:

   ```bash
   cd server
   npm install
   ```

2. [Google AI Studio](https://aistudio.google.com/apikey)에서 API 키를 만든 뒤 `server/.env` 파일 생성:

   ```env
   GEMINI_API_KEY=여기에_붙여넣기
   # 또는 GOOGLE_API_KEY=... (둘 중 하나만 있으면 됨)

   # 프론트와 도메인이 다를 때 CORS (비우면 개발용으로 모든 Origin 허용)
   # ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

   # 선택: QUEST_API_PORT=8787
   # 선택: 모델 (기본 gemini-2.0-flash — 404 나면 gemini-1.5-flash 로 변경)
   # GEMINI_MODEL=gemini-1.5-flash
   ```

3. 서버 실행:

   ```bash
   npm start
   ```

4. 프론트는 `vite.config.js`의 프록시로 `http://localhost:8787` 에 `/api` 를 넘깁니다.  
   API가 꺼져 있으면 퀘스트 생성 시 연결 오류 메시지가 뜹니다.

5. 키 설정 여부 확인: `GET http://localhost:8787/api/health` → `{ "hasKey": true, "provider": "gemini" }`

## HTTP 429 (quota / rate limit)

무료 티어는 **분당·일당 요청 수**에 제한이 있습니다. 짧은 시간에 맞춤 퀘스트를 여러 번 누르면 429가 날 수 있습니다.

- **잠시 후** 다시 시도
- [Rate limits 문서](https://ai.google.dev/gemini-api/docs/rate-limits) · [사용량](https://ai.dev/rate-limit) 확인
- 필요하면 **다른 프로젝트/키** 또는 유료 플랜 검토
- 모델을 더 가벼운 것으로 바꿔 보기: `.env`에 `GEMINI_MODEL=gemini-1.5-flash` (할당량 정책은 Google 쪽에 따름)
