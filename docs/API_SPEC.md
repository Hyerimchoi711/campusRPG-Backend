# Campus RPG — API 명세 정리

백엔드(Express)와 DB 스키마(`database/schema.sql`), 프론트 호출 현황을 기준으로 **명세서(Swagger/OpenAPI)에 넣을 API**를 정리한 문서입니다.  
HTTP 메서드는 요구사항에 맞춰 **GET / POST** 중심으로 서술합니다.

---

## 1. 스키마·용어 참고


| 요구사항 용어 | 현재 코드/DB                                           |
| ------- | -------------------------------------------------- |
| 유저네임    | `users.nickname` (별도 username 컬럼 없음)               |
| 로그인 ID  | 이메일 또는 학번 (`student_id`)                           |
| 대학교     | `university_name`                                  |
| 나이      | `age`                                              |
| 학년      | `users.school_year` (회원가입 입력, 1~6)                    |
| 한줄소개    | `users.intro`                                           |
| 아바타     | `users.avatar` (이모지 문자열)                                 |
| 친구 코드   | `friend_code` (회원가입 시 발급)                          |


---

## 2. 구현됨 — 명세에 포함할 API

메인 백엔드 기본 포트는 `.env`의 `PORT`(미설정 시 `5555`) 기준입니다.


| 메서드  | 경로                        | 설명                                       |
| ---- | ------------------------- | ---------------------------------------- |
| GET  | `/`                       | API 동작 확인(문자열 응답)                        |
| GET  | `/api/health`             | DB 연결 헬스 체크                              |
| POST | `/api/auth/login`         | 로그인 → JWT 발급                             |
| POST | `/api/auth/register`      | 회원가입                                     |
| GET  | `/api/me`                 | 로그인 사용자 + 펫 요약 (`Authorization: Bearer`) |
| GET  | `/api/items`              | 상점 아이템 카탈로그                              |
| GET  | `/api/wallet?userId=`     | 보유 코인 조회                                 |
| GET  | `/api/inventory?userId=`  | 가방(인벤토리) 목록                              |
| POST | `/api/inventory/purchase` | 코인 차감 후 인벤토리에 아이템 추가                     |


### 맞춤 퀘스트 (LLM)

프론트는 Vite 프록시로 **별도 포트(예: 8787)** 의 퀘스트 서버를 호출할 수 있습니다.


| 메서드  | 경로                     | 설명                                  |
| ---- | ---------------------- | ----------------------------------- |
| POST | `/api/quests/generate` | LLM 기반 퀘스트 생성(구현 위치에 따라 베이스 URL 분리) |


OpenAPI 작성 시 **메인 API**와 **퀘스트 LLM API**를 `servers` 또는 태그로 구분하는 것을 권장합니다.

---

## 3. 설계·구현 예정 — 기능별 API (GET / POST)

### 3.1 프로필 (회원가입 정보 + 한줄소개)


| 메서드  | 경로                                       | 설명                                   |
| ---- | ---------------------------------------- | ------------------------------------ |
| GET  | `/api/me` 또는 GET `/api/profile`          | 닉네임, 대학, 나이, 학번/학과, (추가 시) 학년·한줄소개   |
| POST | `/api/me/bio` 또는 POST `/api/profile/bio` | 한줄소개 수정 — body 예: `{ "bio": "..." }` |


### 3.2 홈(펫)


| 메서드 | 경로                       | 설명                                       |
| --- | ------------------------ | ---------------------------------------- |
| GET | `/api/me`                | 레벨, 경험치, 진화 단계, `animal_type` 등 (대부분 커버) |
| GET | `/api/home/theme` *(선택)* | 펫/배경 이미지 URL을 서버에서 내려줄 때                 |


### 3.3 스탯


| 메서드 | 경로           | 설명                                |
| --- | ------------ | --------------------------------- |
| GET | `/api/stats` | 5종 스탯 + 일일 피로도(`daily_fatigue`) 등 |


피로도 증가는 보통 **퀘스트 완료 API** 트랜잭션 안에서 처리.

### 3.4 투두(일정)


| 메서드  | 경로                                     | 설명             |
| ---- | -------------------------------------- | -------------- |
| GET  | `/api/schedules?from=&to=` 또는 `?date=` | 기간/일별 일정 목록    |
| POST | `/api/schedules`                       | 일정 추가          |
| POST | `/api/schedules/:id/complete`          | 완료 처리 + 경험치 지급 |


### 3.5 퀘스트 (기본 일일/주간)


| 메서드  | 경로                         | 설명                        |
| ---- | -------------------------- | ------------------------- |
| GET  | `/api/quests?type=DAILY` 등 | 오늘(또는 주간) 할당된 퀘스트 + 진행 상태 |
| POST | `/api/quests/:id/complete` | 완료 시 스탯·코인·피로도 반영         |


매일/주간 갱신은 크론·배치 또는 **조회 시 `user_quests` 자동 생성** 등 백엔드 로직으로 처리.

### 3.6 친구


| 메서드   | 경로                                 | 설명                                                                 |
| ----- | ---------------------------------- | -------------------------------------------------------------------- |
| GET   | `/api/friends`                     | 로그인 사용자의 친구 목록 (`friendUserId`, `sortOrder`, `nickname`, `intro`, `avatar`) |
| PATCH | `/api/friends/order`               | 친구 정렬 순서 저장 — body: `{ "orderedUserIds": ["2","5",...] }`           |
| DELETE| `/api/friends/:friendUserId`       | 친구 삭제 (양방향 관계 동시 삭제)                                                |
| POST  | `/api/friends/requests`            | 친구 코드로 요청 — body: `{ "friendCode": "..." }`                        |
| GET   | `/api/friends/requests/incoming`   | 받은 친구 요청 목록 (`id`, `fromUserId`, `nickname`, `intro`, `avatar`)     |
| POST  | `/api/friends/requests/:id/accept` | 수락                                                                  |
| POST  | `/api/friends/requests/:id/reject` | 거절                                                                  |

### 3.7 사용자 공개 프로필

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/users/:userId` | 공개 프로필 조회 (`{ user: {...} }`, `friendCode` 항상 노출) |


### 3.8 상점


| 메서드  | 경로                        | 설명            |
| ---- | ------------------------- | ------------- |
| GET  | `/api/items`              | 아이템 리스트 (구현됨) |
| POST | `/api/inventory/purchase` | 구매 (구현됨)      |


### 3.9 가방(인벤토리)


| 메서드  | 경로                       | 설명                                          |
| ---- | ------------------------ | ------------------------------------------- |
| GET  | `/api/inventory?userId=` | 보관 목록 (구현됨)                                 |
| POST | `/api/inventory/use`     | 아이템 사용 — 수량 감소 + `effect_type`에 따른 효과 (미구현) |


---

## 4. 유저 활동 ↔ API 매핑


| 활동             | API                                                                            |
| -------------- | ------------------------------------------------------------------------------ |
| 상점에서 코인으로 구매   | POST `/api/inventory/purchase`                                                 |
| 가방에서 아이템 사용·소모 | POST `/api/inventory/use`                                                      |
| 투두 일정 추가·완료    | POST `/api/schedules`, POST `/api/schedules/:id/complete`                      |
| 퀘스트 수행         | POST `/api/quests/:id/complete`                                                |
| 친구 요청·수락·거절·삭제 | POST `/api/friends/request`, `.../accept`, `.../reject`, `.../remove` + GET 목록 |
| 프로필 한줄소개 수정    | POST `/api/me/bio` 등                                                           |
| 로그인            | POST `/api/auth/login`                                                         |
| 로그아웃           | 클라이언트에서 JWT 삭제가 일반적; 서버 세션 사용 시 POST `/api/auth/logout` 검토                     |


---

## 5. 카카오 연동 (명세 초안)

프론트엔드는 백엔드에서 받은 카카오 로그인 URL로 이동하고, redirect 페이지에서 추출한 인가 코드만 백엔드로 전달합니다.
카카오 accessToken과 client_secret은 백엔드에서만 처리합니다.


| 메서드  | 경로                         | 설명                              |
| ---- | -------------------------- | ------------------------------- |
| GET  | `/api/auth/kakao/start`    | 카카오 authorize URL 반환 |
| POST | `/api/auth/kakao`          | 인가 코드와 redirectUri로 카카오 토큰 교환 후 자체 JWT 발급 |


---

## 6. 보안·명세 작성 시 권장

- `wallet`, `inventory`, `purchase`가 현재 **body/query의 `userId`** 를 받습니다. 운영에서는 **JWT의 `userId`만 신뢰**하고, GET `/api/wallet`, GET `/api/inventory`, POST `/api/inventory/purchase`를 **Bearer 기준으로 통일**하는 편이 안전합니다.
- `/api/me` 및 민감 조회는 **OpenAPI `security: bearerAuth`** 로 표기합니다.

---

## 7. Swagger(OpenAPI) 태그 제안

문서 가독성을 위해 예시 태그:

- `auth` — 로그인, 회원가입, (카카오)
- `me` / `profile` — 내 정보, 한줄소개
- `stats` — 스탯·피로도
- `schedules` — 투두
- `quests` — 기본 퀘스트
- `quest-llm` — 맞춤 퀘스트(별도 서버인 경우)
- `friends` — 친구
- `shop` — 상점 카탈로그
- `inventory` — 가방, 구매, 사용

---

## 8. 변경 이력


| 날짜         | 내용                                          |
| ---------- | ------------------------------------------- |
| 2026-04-06 | 초안 작성 — 구현 API·추가 예정 API·활동 매핑·카카오·보안 메모 정리 |


