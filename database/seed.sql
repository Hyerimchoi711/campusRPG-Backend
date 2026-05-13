PRAGMA foreign_keys = ON;

INSERT INTO users (
  email, password, nickname, student_id, major, university_name, age, school_year, intro, avatar,
  coin, exp, friend_code, kakao_id
) VALUES
('user1@univ.ac.kr', 'password123', '김대학', '20210001', '컴퓨터공학과', '캠퍼스대학교', 22, 2, '운동과 코딩을 좋아해요', '🐱', 1200, 450, 'A1B2C3', NULL),
('user2@univ.ac.kr', 'password123', '이캠퍼스', '20220345', '경영학과', '캠퍼스대학교', 21, 3, '스터디 환영', '🐶', 800, 1200, 'D4E5F6', NULL),
('user3@univ.ac.kr', 'password123', '박코딩', '20191234', '소프트웨어학과', '캠퍼스대학교', 24, 4, '백엔드 개발자', '🦊', 3000, 2500, 'G7H8I9', NULL);

INSERT INTO pets (user_id, name, level, evolution_stage, animal_type, lineage_type, last_evolved_at) VALUES
(1, '부화중인 알', 1, 0, 'egg', NULL, NULL),
(2, '파이로소어', 12, 1, '파이로소어', 'fire', datetime('now', '-3 days')),
(3, '워티', 5, 1, '워티', 'water', datetime('now', '-1 day'));

INSERT INTO stats (user_id, health, social, diligence, focus, creativity, daily_fatigue, quest_daily_stat_sum, last_updated_date) VALUES
(1, 45, 55, 72, 80, 63, 30, 0, date('now')),
(2, 120, 90, 150, 110, 85, 70, 0, date('now')),
(3, 80, 120, 60, 95, 140, 10, 0, date('now')),
(4, 0, 0, 0, 0, 0, 0, 0, NULL);

INSERT INTO schedules (user_id, content, target_date, is_completed) VALUES
(1, '운영체제 과제 제출', date('now'), 1),
(1, '스터디 모임 참석', date('now'), 0),
(1, '헬스장 1시간', date('now', '+1 day'), 0),
(2, '알고리즘 복습', date('now'), 1);

INSERT INTO user_quests (user_id, quest_id, is_completed, assigned_date) VALUES
(1, 1, 1, date('now')),
(1, 2, 1, date('now')),
(1, 3, 1, date('now')),
(1, 4, 0, date('now')),
(1, 5, 0, date('now')),
(1, 6, 0, date('now', 'weekday 1', '-7 days'));

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
INSERT INTO egg_hatch_rules (
  top_stat_type,
  required_level,
  required_user_exp,
  to_lineage_type,
  to_animal_type,
  next_stage,
  is_active
) VALUES
('health',     3, 100, 'fire',      '파이루', 1, 1),
('diligence',  3, 100, 'water',     '워티',   1, 1),
('focus',      3, 100, 'sprout',    '스푸티', 1, 1),
('social',     3, 100, 'cloud',     '클루',   1, 1),
('creativity', 3, 100, 'lightning', '라니',   1, 1);

INSERT INTO pet_evolution_rules (
  lineage_type,
  from_animal_type,
  to_animal_type,
  required_stage,
  required_level,
  required_user_exp,
  priority,
  is_active
) VALUES
('fire',      '파이루', '파이로소어',   1, 7, 250, 0, 1),
('water',     '워티',   '워터북',       1, 7, 250, 0, 1),
('sprout',    '스푸티', '스프라우트랫', 1, 7, 250, 0, 1),
('cloud',     '클루',   '클라우드 윙',  1, 7, 250, 0, 1),
('lightning', '라니',   '라이트닝 혼',  1, 7, 250, 0, 1);

INSERT INTO friendships (user_id, friend_user_id, sort_order) VALUES
(1, 2, 0),
(2, 1, 0);

INSERT INTO friend_requests (from_user_id, to_user_id, status) VALUES
(3, 1, 'pending');

INSERT INTO announcements (title, content, created_at) VALUES
('서버 점검 안내', '5월 10일 새벽 2시~4시 예정 점검입니다. 이용에 참고해 주세요.', datetime('now', '-2 days')),
('친구 기능 업데이트', '친구 코드로 요청하고 수락할 수 있습니다. 프로필에서 친구 코드를 확인하세요.', datetime('now', '-1 day')),
('이벤트 안내', '봄맞이 로그인 이벤트가 진행 중입니다. 자세한 내용은 이벤트 배너를 확인하세요.', datetime('now'));

INSERT INTO events (title, image_url, link_url, created_at) VALUES
('봄맞이 출석 이벤트', '/images/events/spring_attendance.png', 'https://example.com/events/spring', datetime('now', '-3 days')),
('친구 초대 보상', '/images/events/refer_friend.png', 'https://example.com/events/refer', datetime('now', '-1 day')),
('주말 더블 코인', '/images/events/double_coin.png', 'https://example.com/events/double-coin', datetime('now'));