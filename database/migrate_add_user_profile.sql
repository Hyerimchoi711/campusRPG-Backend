-- 기존 campus_rpg DB에 users 프로필 컬럼 추가 (DROP 없음).
-- 이미 schema.sql 최신본으로 갈아엎은 경우 이 스크립트는 필요 없습니다.
USE campus_rpg;

-- 1) nullable 컬럼 추가
ALTER TABLE users
  ADD COLUMN student_id VARCHAR(30) NULL COMMENT '학번' AFTER nickname,
  ADD COLUMN major VARCHAR(80) NULL COMMENT '학과' AFTER student_id,
  ADD COLUMN university_name VARCHAR(120) NULL COMMENT '대학교 이름' AFTER major,
  ADD COLUMN age TINYINT UNSIGNED NULL COMMENT '나이' AFTER university_name;

-- 2) 기존 행 보정 (더미값 — 운영 데이터면 실제 값으로 UPDATE 하세요)
UPDATE users SET
  student_id = CONCAT('LEGACY', LPAD(id, 6, '0')),
  major = '미입력',
  university_name = '미지정대학',
  age = 20
WHERE student_id IS NULL;

-- 3) NOT NULL 및 제약
ALTER TABLE users
  MODIFY student_id VARCHAR(30) NOT NULL COMMENT '학번',
  MODIFY major VARCHAR(80) NOT NULL COMMENT '학과',
  MODIFY university_name VARCHAR(120) NOT NULL COMMENT '대학교 이름',
  MODIFY age TINYINT UNSIGNED NOT NULL COMMENT '나이',
  ADD CONSTRAINT chk_users_age CHECK (age >= 1 AND age <= 120);

-- 4) 학번 전역 유일 (이미 중복 학번이 있으면 먼저 데이터 정리 후 실행)
ALTER TABLE users ADD UNIQUE KEY uk_student_id (student_id);
