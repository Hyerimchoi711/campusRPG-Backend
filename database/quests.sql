-- 기존 데이터와 중복되지 않도록 추가 데이터를 삽입합니다.
INSERT INTO quests (title, type, reward_exp, reward_coin, reward_stat_type, reward_stat_amount, for_roll_pool) VALUES
-- [DAILY] 일일 퀘스트 (50~100 exp, 5~10 amount)

-- Health (건강)
('캠퍼스 1만 보 걷기', 'DAILY', 70, 0, 'health', 6, 1),
('계단으로 강의실 올라가기', 'DAILY', 55, 0, 'health', 5, 1),
('점심에 샐러드 먹기', 'DAILY', 60, 0, 'health', 5, 1),
('스트레칭 10분 하기', 'DAILY', 50, 0, 'health', 5, 1),
('자정 전에 취침하기', 'DAILY', 80, 0, 'health', 8, 1),

-- Diligence (성실)
('강의 맨 앞줄 앉기', 'DAILY', 65, 0, 'diligence', 7, 1),
('강의실 10분 전 도착', 'DAILY', 60, 0, 'diligence', 6, 1),
('학습 플래너 작성하기', 'DAILY', 55, 0, 'diligence', 5, 1),
('놓친 필기 정리하기', 'DAILY', 75, 0, 'diligence', 8, 1),
('메일함 정기 확인하기', 'DAILY', 50, 0, 'diligence', 5, 1),

-- Focus (집중)
('집중 모드로 공부 1시간', 'DAILY', 90, 0, 'focus', 9, 1),
('오답 노트 3개 작성', 'DAILY', 85, 0, 'focus', 8, 1),
('전공 요약본 만들기', 'DAILY', 100, 0, 'focus', 10, 1),
('도서관에서 전공 공부', 'DAILY', 80, 0, 'focus', 8, 1),
('뉴스 기사 1편 읽기', 'DAILY', 55, 0, 'focus', 5, 1),

-- Social (사교)
('학생 식당에서 동기랑 밥 먹기', 'DAILY', 60, 0, 'social', 6, 1),
('교수님께 질문 한 개 하기', 'DAILY', 95, 0, 'social', 9, 1),
('후배에게 조언해주기', 'DAILY', 70, 0, 'social', 7, 1),
('단톡방에 유용한 정보 공유', 'DAILY', 50, 0, 'social', 5, 1),
('동기에게 간식 선물하기', 'DAILY', 65, 0, 'social', 6, 1),

-- Creativity (창의)
('새로운 아이디어 메모하기', 'DAILY', 75, 0, 'creativity', 7, 1),
('좋아하는 노래 가사 쓰기', 'DAILY', 55, 0, 'creativity', 5, 1),
('블로그에 일기 쓰기', 'DAILY', 80, 0, 'creativity', 8, 1),
('낙서로 캐릭터 그리기', 'DAILY', 50, 0, 'creativity', 5, 1),
('새로운 플레이리스트 만들기', 'DAILY', 60, 0, 'creativity', 6, 1),

-- [WEEKLY] 주간 퀘스트 (100~200 exp, 10~20 amount)

-- Health (건강)
('주 3회 조깅하기', 'WEEKLY', 150, 0, 'health', 15, 1),
('주중 야식 안 먹기', 'WEEKLY', 180, 0, 'health', 18, 1),
('등산 또는 공원 산책 2시간', 'WEEKLY', 130, 0, 'health', 13, 1),
('하루 2리터 물 마시기 5일 달성', 'WEEKLY', 200, 0, 'health', 20, 1),
('충분한 숙면 3일 연속 달성', 'WEEKLY', 120, 0, 'health', 12, 1),

-- Diligence (성실)
('이번 주 모든 강의 출석', 'WEEKLY', 200, 0, 'diligence', 20, 1),
('전공 과제 미리 끝내기', 'WEEKLY', 170, 0, 'diligence', 17, 1),
('방 청소 및 분리수거 하기', 'WEEKLY', 110, 0, 'diligence', 11, 1),
('이번 주 학습 목표 완수', 'WEEKLY', 190, 0, 'diligence', 19, 1),
('경제/시사 잡지 읽기', 'WEEKLY', 140, 0, 'diligence', 14, 1),

-- Focus (집중)
('중간/기말 대비 요약 노트 완성', 'WEEKLY', 200, 0, 'focus', 20, 1),
('자격증/어학 공부 5시간 달성', 'WEEKLY', 180, 0, 'focus', 18, 1),
('코딩/디자인 실습 1개 완료', 'WEEKLY', 160, 0, 'focus', 16, 1),
('외부 특강/세미나 참여', 'WEEKLY', 150, 0, 'focus', 15, 1),
('어려운 논문 1편 정독', 'WEEKLY', 190, 0, 'focus', 19, 1),

-- Social (사교)
('팀플 회의 원활하게 이끌기', 'WEEKLY', 180, 0, 'social', 18, 1),
('학기 과회/번개 모임 참석', 'WEEKLY', 120, 0, 'social', 12, 1),
('타과생과 대화 나누기', 'WEEKLY', 150, 0, 'social', 15, 1),
('동아리 정기 모임 완전 참여', 'WEEKLY', 160, 0, 'social', 16, 1),
('고민 있는 친구 상담해주기', 'WEEKLY', 130, 0, 'social', 13, 1),

-- Creativity (창의)
('공모전 아이디어 기획안 작성', 'WEEKLY', 200, 0, 'creativity', 20, 1),
('개인 프로젝트 한 단계 진전', 'WEEKLY', 180, 0, 'creativity', 18, 1),
('전시회 또는 공연 관람', 'WEEKLY', 140, 0, 'creativity', 14, 1),
('나만의 요리 레시피 도전', 'WEEKLY', 110, 0, 'creativity', 11, 1),
('사용 중인 앱 개선점 제안해보기', 'WEEKLY', 160, 0, 'creativity', 16, 1);