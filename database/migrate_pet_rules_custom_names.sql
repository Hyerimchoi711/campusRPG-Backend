PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

-- 기존 규칙 데이터 초기화
DELETE FROM egg_hatch_rules;
DELETE FROM pet_evolution_rules;

-- 알 -> 유아기(부화) 규칙
-- 기준: 레벨 3, 유저 경험치 100
INSERT INTO egg_hatch_rules (
  top_stat_type,
  required_level,
  required_user_exp,
  to_lineage_type,
  to_animal_type,
  next_stage,
  is_active
) VALUES
('health', 3, 100, 'fire', '파이루', 1, 1),
('diligence', 3, 100, 'water', '워티', 1, 1),
('focus', 3, 100, 'sprout', '스푸티', 1, 1),
('social', 3, 100, 'cloud', '클루', 1, 1),
('creativity', 3, 100, 'lightning', '라니', 1, 1);

-- 유아기 -> 진화형 규칙
-- 기준: 레벨 7, 유저 경험치 250
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
('fire', '파이루', '파이로소어', 1, 7, 250, 0, 1),
('water', '워티', '워터북', 1, 7, 250, 0, 1),
('sprout', '스푸티', '스프라우트랫', 1, 7, 250, 0, 1),
('cloud', '클루', '클라우드 윙', 1, 7, 250, 0, 1),
('lightning', '라니', '라이트닝 혼', 1, 7, 250, 0, 1);

-- 기존 유저 펫 데이터를 새 규칙 체계에 맞게 보정 (선택적 데이터 정리)
-- user_id=1은 기본 알 상태 유지
UPDATE pets
SET animal_type = 'egg',
    lineage_type = NULL,
    name = '부화중인 알',
    evolution_stage = 0,
    last_evolved_at = NULL
WHERE user_id = 1;

-- user_id=2는 fire 계보 진화형으로 보정
UPDATE pets
SET animal_type = '파이로소어',
    lineage_type = 'fire',
    name = '파이로소어',
    evolution_stage = 1,
    last_evolved_at = datetime('now', '-3 days')
WHERE user_id = 2;

-- user_id=3은 water 계보 유아기로 보정
UPDATE pets
SET animal_type = '워티',
    lineage_type = 'water',
    name = '워티',
    evolution_stage = 1,
    last_evolved_at = datetime('now', '-1 day')
WHERE user_id = 3;

COMMIT;
