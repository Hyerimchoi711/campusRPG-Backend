-- schema.sql 실행 후에만 실행하세요. friends 등 테이블이 없으면 Unknown table 오류가 납니다.
-- 한 번에 초기화하려면 database/init_all.sql 을 사용하세요.

USE campus_rpg;

-- 1. 유저 데이터 (비밀번호: 평문 password123 — 로그인 API에서 bcrypt 검증 시 시드는 해시로 바꿀 것)
INSERT INTO users (
  email, password, nickname, student_id, major, university_name, age,
  coin, exp, friend_code
) VALUES
('user1@univ.ac.kr', 'password123', '김대학', '20210001', '컴퓨터공학과', '캠퍼스대학교', 22, 1200, 450, 'A1B2C3'),
('user2@univ.ac.kr', 'password123', '이캠퍼스', '20220345', '경영학과', '캠퍼스대학교', 21, 800, 1200, 'D4E5F6'),
('user3@univ.ac.kr', 'password123', '박코딩', '20191234', '소프트웨어학과', '캠퍼스대학교', 24, 3000, 2500, 'G7H8I9');

-- 2. 펫 데이터
INSERT INTO pets (user_id, name, level, evolution_stage, animal_type) VALUES
(1, '알이', 1, 0, 'egg'),
(2, '불꽃드래곤', 12, 2, 'dragon'),
(3, '아기슬라임', 5, 1, 'slime');

-- 3. 스탯 데이터
INSERT INTO stats (user_id, health, social, diligence, focus, creativity, daily_fatigue, last_updated_date) VALUES
(1, 45, 55, 72, 80, 63, 30, CURDATE()),
(2, 120, 90, 150, 110, 85, 70, CURDATE()),
(3, 80, 120, 60, 95, 140, 10, CURDATE());

-- 4. 일정 데이터 (Schedules)
INSERT INTO schedules (user_id, content, target_date, is_completed) VALUES
(1, '운영체제 과제 제출', CURDATE(), TRUE),
(1, '스터디 모임 참석', CURDATE(), FALSE),
(1, '헬스장 1시간', DATE_ADD(CURDATE(), INTERVAL 1 DAY), FALSE),
(2, '알고리즘 복습', CURDATE(), TRUE);

-- 5. 퀘스트 마스터 데이터 (Quests)
INSERT INTO quests (title, type, reward_coin, reward_stat_type, reward_stat_amount) VALUES
('아침 9시 전 기상', 'DAILY', 50, 'diligence', 1),
('강의 출석 완료', 'DAILY', 80, 'diligence', 2),
('도서관 2시간 공부', 'DAILY', 120, 'focus', 2),
('과제 제출하기', 'DAILY', 150, 'diligence', 3),
('동아리 활동 참여', 'DAILY', 100, 'social', 2),
('전공 서적 1권 읽기', 'WEEKLY', 500, 'focus', 5),
('운동 3회 이상 하기', 'WEEKLY', 300, 'health', 5),
('새로운 친구 1명 사귀기', 'WEEKLY', 400, 'social', 5);

-- 6. 유저별 퀘스트 진행 상태 데이터 (User_Quests)
INSERT INTO user_quests (user_id, quest_id, is_completed, assigned_date) VALUES
(1, 1, TRUE, CURDATE()),
(1, 2, TRUE, CURDATE()),
(1, 3, TRUE, CURDATE()),
(1, 4, FALSE, CURDATE()),
(1, 5, FALSE, CURDATE()),
(1, 6, FALSE, DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)); -- 이번 주 월요일

-- 7. 친구 관계 데이터 (Friends)
INSERT INTO friends (user_id, friend_id, status) VALUES
(1, 2, 'ACCEPTED'), -- 김대학과 이캠퍼스는 친구
(3, 1, 'PENDING');  -- 박코딩이 김대학에게 친구 요청 보냄

-- 8. 상점 아이템 데이터 (Items)
INSERT INTO items (name, description, price, image_url, icon_emoji, effect_type) VALUES
('경험치 부스터', '1시간 동안 획득 경험치 2배', 500, '/images/items/exp_boost.png', '🔥', 'EXP_BOOST'),
('스탯 초기화권', '모든 스탯을 초기화합니다', 1000, '/images/items/stat_reset.png', '🔄', 'STAT_RESET'),
('황금 알', '희귀한 펫이 부화할 확률 증가', 2000, '/images/items/golden_egg.png', '🥚', 'RARE_EGG'),
('에너지 드링크', '오늘의 피로도를 10 회복', 300, '/images/items/energy_drink.png', '🥤', 'FATIGUE_RECOVERY'),
('이름 변경권', '펫의 이름을 변경합니다', 800, '/images/items/name_change.png', '🏷️', 'NAME_CHANGE'),
('신비한 열매', '무작위 스탯 1~3 증가', 1500, '/images/items/mystery_fruit.png', '🍒', 'RANDOM_STAT'),
('부화 촉진제', '알 부화 시간을 단축시킵니다', 600, '/images/items/hatch_boost.png', '⏱️', 'HATCH_BOOST'),
('펫 간식', '펫의 친밀도를 소폭 상승시킵니다', 200, '/images/items/pet_snack.png', '🍖', 'AFFECTION_UP');

-- 9. 유저 보관함 샘플 (user_id=1, 데모용 — 없애려면 이 블록만 삭제)
INSERT INTO user_inventory (user_id, item_id, quantity) VALUES
(1, 8, 2);
