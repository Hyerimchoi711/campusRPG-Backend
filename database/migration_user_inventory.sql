PRAGMA foreign_keys = ON;

ALTER TABLE items ADD COLUMN icon_emoji TEXT;

CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE (user_id, item_id)
);

CREATE TRIGGER IF NOT EXISTS trg_user_inventory_updated_at
AFTER UPDATE ON user_inventory
FOR EACH ROW
BEGIN
    UPDATE user_inventory
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
