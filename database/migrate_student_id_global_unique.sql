-- 이전에 uk_univ_student(대학+학번) 복합 유니크만 적용한 DB용.
-- student_id 단일 유니크로 바꿉니다. (새 migrate_add_user_profile.sql 만 실행했다면 불필요)
USE campus_rpg;

ALTER TABLE users DROP INDEX uk_univ_student;
ALTER TABLE users ADD UNIQUE KEY uk_student_id (student_id);
