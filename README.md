# 캠퍼스 라이프 RPG — Backend

Node.js(Express) API, MySQL 스키마, 퀘스트 LLM(`server`)을 포함합니다. **프론트엔드(React)는 별도 레포**에서 관리합니다.

## 기술 스택

- **API:** Node.js, Express, MySQL (`mysql2`)
- **퀘스트 LLM:** `server/` (Google Gemini, 별도 포트 기본 8787)

## 폴더 구조

| 경로 | 설명 |
|------|------|
| `backend/` | 메인 게임 API (인증, 프로필, 상점, 지갑 등) |
| `database/` | 스키마·마이그레이션·시드 SQL |
| `server/` | 맞춤 퀘스트 생성 API (Gemini) |
| `docs/` | API 문서 등 |

## 실행

### 1. MySQL

`database/schema.sql` 등으로 DB를 준비한 뒤 `backend/.env`에 연결 정보를 넣습니다. 샘플은 `backend/.env.example` 참고.

### 2. 메인 API

```bash
cd backend
npm install
npm start
```

기본 포트는 `5555` (`.env`의 `PORT`로 변경). CORS는 `ALLOWED_ORIGINS`에 프론트 URL을 쉼표로 넣습니다. 비우면 개발 편의상 모든 Origin을 허용합니다.

### 3. 퀘스트 LLM API (선택)

```bash
cd server
npm install
npm start
```

`server/.env`에 `GEMINI_API_KEY` 등 설정 (`server/.env.example` 참고).

## Python / uv

`requirements.txt`는 선택적 파이썬 작업용 예시입니다. 메인 백엔드는 Node.js만 있으면 됩니다.

## 협업

브랜치·커밋 컨벤션은 팀 규칙에 따릅니다.
