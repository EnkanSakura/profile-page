-- D1 数据库 Schema
-- 个人社媒链接展示页 - 配置存储

-- 配置表：每一条记录按配置组使用 JSON 存储配置内容
CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_group TEXT UNIQUE NOT NULL,  -- 配置组名：profile, socialLinks, appearance, effects, security
    config_data TEXT NOT NULL,           -- JSON 格式的配置内容
    version INTEGER DEFAULT 1,           -- 版本号，用于乐观锁
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 配置变更日志表（可选，用于审计）
CREATE TABLE IF NOT EXISTS config_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_group TEXT NOT NULL,
    old_data TEXT,
    new_data TEXT NOT NULL,
    changed_by TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化默认配置
INSERT OR REPLACE INTO config (config_group, config_data, version) VALUES
    ('profile', '{"username":"@Yourname","bio":"分享生活 · 记录美好 · 连接世界","avatarUrls":["https://picsum.photos/200/200"]}', 1),
    ('socialLinks', '[{"name":"GitHub","url":"https://github.com/Yourname","icon":"fab fa-github","color":"rgba(51, 51, 51, 0.8)"}]', 1),
    ('appearance', '{"backgroundImage":"https://picsum.photos/1920/1080","portraitBackgroundImage":"","overlayOpacity":0.4,"backdropBlur":10,"cardOpacity":0.15,"footer":"© 2026 EnkanSakura. All rights reserved."}', 1),
    ('effects', '{"enabled":true,"rotationIntensity":1,"parallaxIntensity":1,"recoveryDuration":500}', 1),
    ('security', '{"disableRightClick":true,"disableDevTools":false}', 1);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_config_group ON config(config_group);
CREATE INDEX IF NOT EXISTS idx_config_logs_group ON config_logs(config_group);
CREATE INDEX IF NOT EXISTS idx_config_logs_time ON config_logs(changed_at);
