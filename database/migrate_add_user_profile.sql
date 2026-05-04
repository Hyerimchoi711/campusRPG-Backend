PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN student_id TEXT;
ALTER TABLE users ADD COLUMN major TEXT;
ALTER TABLE users ADD COLUMN university_name TEXT;
ALTER TABLE users ADD COLUMN age INTEGER;

UPDATE users SET
  student_id = 'LEGACY' || printf('%06d', id),
  major = '미입력',
  university_name = '미지정대학교',
  age = 20
WHERE student_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_student_id ON users(student_id);
