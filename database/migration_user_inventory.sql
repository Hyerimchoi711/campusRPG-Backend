-- 기존 DB에 이미 items 테이블만 있을 때 한 번만 실행 (신규면 schema.sql 만으로 충분)
USE campus_rpg;

ALTER TABLE items
  ADD COLUMN icon_emoji VARCHAR(16) NULL COMMENT '이미지 없을 때 그리드·상점용 이모지' AFTER image_url;

CREATE TABLE IF NOT EXISTS user_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1 COMMENT '같은 아이템 스택',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_item (user_id, item_id)
);
