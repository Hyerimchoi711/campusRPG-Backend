PRAGMA foreign_keys = ON;

ALTER TABLE pets ADD COLUMN lineage_type TEXT;
ALTER TABLE pets ADD COLUMN last_evolved_at TEXT;

UPDATE pets
SET name = '부화중인 알'
WHERE animal_type = 'egg' AND (name IS NULL OR name = '' OR name = '알이');

UPDATE pets
SET lineage_type = CASE
  WHEN animal_type IN ('baby_cat', 'cat', 'cool_cat') THEN 'cat'
  WHEN animal_type IN ('baby_dog', 'dog', 'cool_dog') THEN 'dog'
  WHEN animal_type IN ('baby_rabbit', 'rabbit', 'cool_rabbit') THEN 'rabbit'
  WHEN animal_type IN ('baby_bear', 'bear', 'cool_bear') THEN 'bear'
  WHEN animal_type IN ('baby_fox', 'fox', 'cool_fox') THEN 'fox'
  ELSE NULL
END
WHERE lineage_type IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_pets_user_id ON pets(user_id);
