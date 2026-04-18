-- =============================================================================
-- 스키마만 적용 (테이블 DROP + CREATE). 시드 데이터는 seed.sql을 이어서 실행하세요.
-- DBeaver 오류 방지: 이 파일에 CREATE DATABASE 없음. campus_rpg DB는 미리 만들어 두세요.
-- "Can't create database ... exists" 가 나오면 → 예전 스크립트/다른 탭을 실행 중인지 확인하세요.
-- "Unknown table ... friends" 가 나오면 → schema가 끝까지 실행되지 않았거나 seed만 먼저 실행한 경우입니다.
-- 한 번에 하려면: init_all.sql 만 실행하면 됩니다.
-- =============================================================================
USE campus_rpg;

-- 기존 테이블 초기화 (의존성 순서의 역순으로 삭제)
DROP TABLE IF EXISTS friends;
DROP TABLE IF EXISTS user_quests;
DROP TABLE IF EXISTS quests;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS user_inventory;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS stats;
DROP TABLE IF EXISTS pets;
DROP TABLE IF EXISTS users;

-- 1. 유저 테이블 (Users)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL COMMENT '로그인 아이디',
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL COMMENT '닉네임',
    student_id VARCHAR(30) NOT NULL UNIQUE COMMENT '학번 (전역 중복 불가)',
    major VARCHAR(80) NOT NULL COMMENT '학과',
    university_name VARCHAR(120) NOT NULL COMMENT '대학교 이름',
    age TINYINT UNSIGNED NOT NULL COMMENT '나이',
    coin INT DEFAULT 0 COMMENT '보유 코인',
    exp INT DEFAULT 0 COMMENT '보유 경험치',
    friend_code VARCHAR(20) UNIQUE NOT NULL COMMENT '친구 추가용 고유 코드',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_age CHECK (age >= 1 AND age <= 120)
);

-- 2. 펫 테이블 (Pets)
CREATE TABLE pets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(50) NOT NULL COMMENT '펫 이름',
    level INT DEFAULT 1 COMMENT '펫 레벨',
    evolution_stage INT DEFAULT 0 COMMENT '진화 단계 (0: 알, 1: 1단계, 2: 2단계)',
    animal_type VARCHAR(50) DEFAULT 'egg' COMMENT '진화된 동물 종류 (예: slime, dragon)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. 스탯 테이블 (Stats)
CREATE TABLE stats (
    user_id INT PRIMARY KEY,
    health INT DEFAULT 0 COMMENT '건강',
    social INT DEFAULT 0 COMMENT '사교',
    diligence INT DEFAULT 0 COMMENT '성실',
    focus INT DEFAULT 0 COMMENT '집중',
    creativity INT DEFAULT 0 COMMENT '창의',
    daily_fatigue INT DEFAULT 0 COMMENT '오늘 쌓은 피로도 (최대 70)',
    last_updated_date DATE COMMENT '피로도 일일 초기화를 위한 날짜 기록',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. 일정 테이블 (Schedules - 유저가 직접 등록하는 투두)
CREATE TABLE schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content VARCHAR(255) NOT NULL COMMENT '일정 내용',
    target_date DATE NOT NULL COMMENT '일정 날짜',
    is_completed BOOLEAN DEFAULT FALSE COMMENT '완료 여부',
    reward_exp INT DEFAULT 50 COMMENT '보상 경험치',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. 퀘스트 마스터 테이블 (Quests - 시스템이 부여하는 퀘스트 종류)
CREATE TABLE quests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type ENUM('DAILY', 'WEEKLY') NOT NULL,
    reward_coin INT DEFAULT 0,
    reward_stat_type VARCHAR(20) COMMENT '보상 스탯 종류 (예: health, focus)',
    reward_stat_amount INT DEFAULT 0
);

-- 6. 유저별 퀘스트 진행 상태 테이블 (User_Quests)
CREATE TABLE user_quests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    quest_id INT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    assigned_date DATE NOT NULL COMMENT '퀘스트 할당 날짜 (일일/주간 초기화 기준)',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE
);

-- 7. 친구 관계 테이블 (Friends)
CREATE TABLE friends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '요청을 보낸 유저',
    friend_id INT NOT NULL COMMENT '요청을 받은 유저',
    status ENUM('PENDING', 'ACCEPTED') DEFAULT 'PENDING' COMMENT '요청 대기 중 / 수락됨',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (user_id, friend_id) -- 중복 친구 요청 방지
);

-- 8. 상점 아이템 마스터 (이름·가격·효과 등 정의)
CREATE TABLE items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price INT NOT NULL,
    image_url VARCHAR(255) COMMENT '아이템 이미지 경로',
    icon_emoji VARCHAR(16) NULL COMMENT '이미지 없을 때 그리드·상점용 이모지',
    effect_type VARCHAR(50) COMMENT '효과 종류 (예: EXP_BOOST, FATIGUE_RECOVERY)'
);

-- 9. 유저 아이템 보관함 (구매·보상으로 쌓인 수량)
CREATE TABLE user_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1 COMMENT '같은 아이템 스택',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_item (user_id, item_id)
);
