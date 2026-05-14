PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS friend_requests;
DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS user_weekly_quest_roll;
DROP TABLE IF EXISTS user_daily_quest_roll;
DROP TABLE IF EXISTS user_quests;
DROP TABLE IF EXISTS quests;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS todo_completion_reward_claims;
DROP TABLE IF EXISTS user_inventory;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS pet_evolution_history;
DROP TABLE IF EXISTS pet_evolution_rules;
DROP TABLE IF EXISTS egg_hatch_rules;
DROP TABLE IF EXISTS stats;
DROP TABLE IF EXISTS pets;
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT NOT NULL,
    student_id TEXT NOT NULL UNIQUE,
    major TEXT NOT NULL,
    university_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    school_year INTEGER NOT NULL DEFAULT 1 CHECK (school_year BETWEEN 1 AND 6),
    intro TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    kakao_id TEXT UNIQUE,
    coin INTEGER DEFAULT 0,
    exp INTEGER DEFAULT 0,
    friend_code TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_age CHECK (age >= 1 AND age <= 120)
);

CREATE TABLE pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    evolution_stage INTEGER DEFAULT 0,
    animal_type TEXT DEFAULT 'egg',
    lineage_type TEXT,
    last_evolved_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE stats (
    user_id INTEGER PRIMARY KEY,
    health INTEGER DEFAULT 0,
    social INTEGER DEFAULT 0,
    diligence INTEGER DEFAULT 0,
    focus INTEGER DEFAULT 0,
    creativity INTEGER DEFAULT 0,
    daily_fatigue INTEGER DEFAULT 0,
    quest_daily_stat_sum INTEGER NOT NULL DEFAULT 0,
    last_updated_date TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    target_date TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    reward_exp INTEGER DEFAULT 50,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE todo_completion_reward_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date_key TEXT NOT NULL,
    client_todo_id TEXT NOT NULL,
    awarded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, date_key, client_todo_id)
);

CREATE TABLE quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('DAILY', 'WEEKLY')),
    reward_exp INTEGER DEFAULT 0,
    reward_coin INTEGER NOT NULL DEFAULT 0,
    reward_stat_type TEXT,
    reward_stat_amount INTEGER DEFAULT 0,
    for_roll_pool INTEGER NOT NULL DEFAULT 1 CHECK (for_roll_pool IN (0, 1))
);

CREATE TABLE user_daily_quest_roll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    roll_date TEXT NOT NULL,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 4),
    quest_id INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    reward_granted_this_slot INTEGER NOT NULL DEFAULT 0,
    quest_source TEXT NOT NULL DEFAULT 'default' CHECK (quest_source IN ('default', 'llm')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE,
    UNIQUE (user_id, roll_date, slot)
);

CREATE TABLE user_weekly_quest_roll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    week_id TEXT NOT NULL,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 2),
    quest_id INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    reward_granted_this_slot INTEGER NOT NULL DEFAULT 0,
    quest_source TEXT NOT NULL DEFAULT 'default' CHECK (quest_source IN ('default', 'llm')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE,
    UNIQUE (user_id, week_id, slot)
);

CREATE TABLE user_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    quest_id INTEGER NOT NULL,
    is_completed INTEGER DEFAULT 0,
    assigned_date TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE
);

CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    image_url TEXT,
    icon_emoji TEXT,
    effect_type TEXT
);

CREATE TABLE user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE (user_id, item_id)
);

CREATE TABLE egg_hatch_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    top_stat_type TEXT NOT NULL CHECK (top_stat_type IN ('health', 'social', 'diligence', 'focus', 'creativity')),
    required_level INTEGER NOT NULL DEFAULT 1,
    required_user_exp INTEGER NOT NULL DEFAULT 0,
    to_lineage_type TEXT NOT NULL,
    to_animal_type TEXT NOT NULL,
    next_stage INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE pet_evolution_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lineage_type TEXT NOT NULL,
    from_animal_type TEXT NOT NULL,
    to_animal_type TEXT NOT NULL,
    required_stage INTEGER NOT NULL,
    required_level INTEGER NOT NULL DEFAULT 1,
    required_user_exp INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE (lineage_type, from_animal_type, required_stage)
);

CREATE TABLE pet_evolution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    from_animal_type TEXT NOT NULL,
    to_animal_type TEXT NOT NULL,
    evolved_at TEXT DEFAULT CURRENT_TIMESTAMP,
    trigger_user_exp INTEGER,
    trigger_pet_level INTEGER,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
);

CREATE TABLE friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_user_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_friendships_not_self CHECK (user_id <> friend_user_id),
    UNIQUE (user_id, friend_user_id)
);

CREATE TABLE friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_friend_requests_not_self CHECK (from_user_id <> to_user_id)
);

CREATE UNIQUE INDEX uk_friend_requests_pending_pair
ON friend_requests(from_user_id, to_user_id)
WHERE status = 'pending';

CREATE TABLE announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    image_url TEXT,
    link_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_user_inventory_updated_at
AFTER UPDATE ON user_inventory
FOR EACH ROW
BEGIN
    UPDATE user_inventory
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER trg_pets_lineage_guard_insert
BEFORE INSERT ON pets
FOR EACH ROW
WHEN (
  (NEW.animal_type = 'egg' AND NEW.lineage_type IS NOT NULL) OR
  (NEW.animal_type <> 'egg' AND NEW.lineage_type IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'INVALID_PET_LINEAGE_STATE');
END;

CREATE TRIGGER trg_pets_lineage_guard_update
BEFORE UPDATE ON pets
FOR EACH ROW
WHEN (
  (NEW.animal_type = 'egg' AND NEW.lineage_type IS NOT NULL) OR
  (NEW.animal_type <> 'egg' AND NEW.lineage_type IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'INVALID_PET_LINEAGE_STATE');
END;

