PRAGMA foreign_keys = ON;

DROP INDEX IF EXISTS uk_univ_student;
CREATE UNIQUE INDEX IF NOT EXISTS uk_student_id ON users(student_id);
