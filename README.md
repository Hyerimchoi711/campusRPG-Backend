# 캠퍼스 라이프 RPG — Backend

Node.js(Express) API, SQLite3 스키마를 포함합니다. **프론트엔드(React)는 별도 레포**에서 관리합니다.

## 기술 스택

- **API:** Node.js, Express, SQLite3 (`sqlite3`)

## 폴더 구조

| 경로        | 설명                                        |
| ----------- | ------------------------------------------- |
| `backend/`  | 메인 게임 API (인증, 프로필, 상점, 지갑 등) |
| `database/` | 스키마·마이그레이션·시드 SQL                |
| `docs/`     | API 문서 등                                 |

### Node.js / Express

- `server.js` 파일에서 기본 라우트를 관리합니다.
- `swagger.js` 파일에서 Swagger 형식의 API 문서를 제공합니다.
- `routes/` 폴더에서 API 라우트를 관리합니다.

### SQLite3

- `database/schema.sql` 등으로 DB를 준비한 뒤 `backend/.env`에 연결 정보를 넣습니다. 샘플은 `backend/.env.example` 참고.

- `database/campus_rpg.sqlite` 파일로 DB를 관리합니다. 해당 SQLite 파일은 Git 추적에서 제외합니다.

## 실행

### 메인 API

```bash
cd backend
npm install
npm start
```

기본 포트는 `8888`이며, `.env`의 `PORT` 값으로 변경할 수 있습니다. CORS는 `ALLOWED_ORIGINS`에 프론트 URL을 쉼표로 구분해 넣습니다. 값을 비우면 개발 편의상 모든 Origin을 허용합니다.

## 협업

브랜치·커밋 컨벤션은 팀 규칙에 따릅니다.
