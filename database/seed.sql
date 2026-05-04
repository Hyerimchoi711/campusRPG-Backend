PRAGMA foreign_keys = ON;

INSERT INTO users (
  email, password, nickname, student_id, major, university_name, age,
  coin, exp, friend_code
) VALUES
('user1@univ.ac.kr', 'password123', '김대학', '20210001', '컴퓨터공학과', '캠퍼스대학교', 22, 1200, 450, 'A1B2C3'),
('user2@univ.ac.kr', 'password123', '이캠퍼스', '20220345', '경영학과', '캠퍼스대학교', 21, 800, 1200, 'D4E5F6'),
('user3@univ.ac.kr', 'password123', '박코딩', '20191234', '소프트웨어학과', '캠퍼스대학교', 24, 3000, 2500, 'G7H8I9');

INSERT INTO pets (user_id, name, level, evolution_stage, animal_type) VALUES
(1, '뚜이', 1, 0, 'egg'),
(2, '불꽃드래곤', 12, 2, 'dragon'),
(3, '아기슬라임', 5, 1, 'slime');

INSERT INTO stats (user_id, health, social, diligence, focus, creativity, daily_fatigue, last_updated_date) VALUES
(1, 45, 55, 72, 80, 63, 30, date('now')),
(2, 120, 90, 150, 110, 85, 70, date('now')),
(3, 80, 120, 60, 95, 140, 10, date('now'));

INSERT INTO schedules (user_id, content, target_date, is_completed) VALUES
(1, '운영체제 과제 제출', date('now'), 1),
(1, '스터디 모임 참석', date('now'), 0),
(1, '헬스장 1시간', date('now', '+1 day'), 0),
(2, '알고리즘 복습', date('now'), 1);

INSERT INTO quests (title, type, reward_coin, reward_stat_type, reward_stat_amount) VALUES
('아침 9시 전 기상', 'DAILY', 50, 'diligence', 1),
('강의 출석 완료', 'DAILY', 80, 'diligence', 2),
('도서관 2시간 공부', 'DAILY', 120, 'focus', 2),
('과제 제출하기', 'DAILY', 150, 'diligence', 3),
('동아리 활동 참여', 'DAILY', 100, 'social', 2),
('전공 서적 1권 읽기', 'WEEKLY', 500, 'focus', 5),
('운동 3회 이상 하기', 'WEEKLY', 300, 'health', 5),
('새로운 친구 1명 사귀기', 'WEEKLY', 400, 'social', 5);

INSERT INTO user_quests (user_id, quest_id, is_completed, assigned_date) VALUES
(1, 1, 1, date('now')),
(1, 2, 1, date('now')),
(1, 3, 1, date('now')),
(1, 4, 0, date('now')),
(1, 5, 0, date('now')),
(1, 6, 0, date('now', 'weekday 1', '-7 days'));

INSERT INTO friends (user_id, friend_id, status) VALUES
(1, 2, 'ACCEPTED'),
(3, 1, 'PENDING');

INSERT INTO items (name, description, price, image_url, icon_emoji, effect_type) VALUES
('경험치 부스터', '1시간 동안 획득 경험치 2배', 500, '/images/items/exp_boost.png', 'XP', 'EXP_BOOST'),
('스탯 초기화권', '모든 스탯을 초기화합니다', 1000, '/images/items/stat_reset.png', 'RST', 'STAT_RESET'),
('황금 알', '희귀 펫이 부화할 확률 증가', 2000, '/images/items/golden_egg.png', 'EGG', 'RARE_EGG'),
('에너지 드링크', '오늘의 피로도를 10 회복', 300, '/images/items/energy_drink.png', 'NRG', 'FATIGUE_RECOVERY'),
('이름 변경권', '펫의 이름을 변경합니다', 800, '/images/items/name_change.png', 'TAG', 'NAME_CHANGE'),
('신비한 열매', '무작위 스탯 1~3 증가', 1500, '/images/items/mystery_fruit.png', 'FRT', 'RANDOM_STAT'),
('부화 촉진제', '알 부화 시간을 단축합니다', 600, '/images/items/hatch_boost.png', 'HCH', 'HATCH_BOOST'),
('펫 간식', '펫의 친밀도를 소폭 상승시킵니다', 200, '/images/items/pet_snack.png', 'SNK', 'AFFECTION_UP');

INSERT INTO user_inventory (user_id, item_id, quantity) VALUES
(1, 8, 2);
