CREATE TABLE IF NOT EXISTS shelters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_name TEXT NOT NULL,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE RESTRICT,
    content TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    is_synced INTEGER NOT NULL DEFAULT 0,
    posted_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_free_chat INTEGER NOT NULL DEFAULT 0,
    occurred_at DATETIME,
    status TEXT,
    deleted_at DATETIME
);

CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    media_type TEXT NOT NULL,
    file_name TEXT,
    url TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    is_synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS post_location_tracks (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    recorded_at DATETIME NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    is_synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, -- どの投稿へのコメントか
    author_name TEXT NOT NULL, -- コメントした人の名前
    content TEXT NOT NULL, -- コメント内容
    status TEXT NOT NULL DEFAULT '未対応',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    is_synced INTEGER NOT NULL DEFAULT 0
);

-- 同期メタデータテーブル（同期処理の追跡用）
CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shelter_id INTEGER REFERENCES shelters(id) ON DELETE SET NULL, -- どの避難所からの同期か
    sync_type TEXT NOT NULL, -- 'full', 'incremental', 'manual'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    posts_synced INTEGER DEFAULT 0,
    comments_synced INTEGER DEFAULT 0,
    location_tracks_synced INTEGER DEFAULT 0,
    error_message TEXT,
    target_url TEXT -- 同期先のURL
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_shelter_id ON sync_logs(shelter_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_location_tracks_post_id ON post_location_tracks(post_id);

-- 1. 避難所テーブル
INSERT OR IGNORE INTO shelters (id, name, address, latitude, longitude, created_at) VALUES
(1, 'A小学校 体育館', '名古屋市中区1-1-1', 35.1701, 136.9001, '2025-10-28 09:00:00'),
(2, 'B中学校 武道場', '名古屋市中村区2-2-2', 35.1691, 136.8801, '2025-10-28 09:00:00'),
(3, 'C公民館', '名古屋市東区3-3-3', 35.1801, 136.9201, '2025-10-28 09:00:00'),
(4, 'D大学 講堂',  '名古屋市千種区4-4-4', 35.1501, 136.9501, '2025-10-28 09:00:00'),
(5, 'E福祉センター', '名古屋市昭和区5-5-5', 35.1401, 136.9301, '2025-10-28 09:00:00'),
(6, 'F高校 体育館', '名古屋市瑞穂区6-6-6', 35.1301, 136.9401, '2025-10-28 09:00:00'),
(7, 'Gコミュニティセンター', '名古屋市熱田区7-7-7', 35.1201, 136.9101, '2025-10-28 09:00:00'),
(8, 'H生涯学習センター', '名古屋市中川区8-8-8', 35.1401, 136.8701, '2025-10-28 09:00:00'),
(9, 'Iスポーツセンター', '名古屋市港区9-9-9', 35.1001, 136.8801, '2025-10-28 09:00:00'),
(10, 'J地区会館', '名古屋市南区10-10-10', 35.1101, 136.9201, '2025-10-28 09:00:00');

-- 2. 投稿テーブル
INSERT OR IGNORE INTO posts (id, author_name, shelter_id, content, latitude, longitude, is_synced, posted_at, created_at, updated_at, is_free_chat, occurred_at, status, deleted_at) VALUES
('a0000001-0000-0000-0000-000000000001', '佐藤', 1, 'A小学校、まだ余裕あります。水あります。', 35.1701, 136.9001, 0, '2025-10-28 10:00:00', '2025-10-28 10:00:00', '2025-10-28 10:00:00', 0, '2025-10-28 09:55:00', '通常', NULL),
('a0000002-0000-0000-0000-000000000002', '鈴木', 2, 'B中学校、混雑してきました。毛布が足りません。', 35.1691, 136.8801, 0, '2025-10-28 10:05:00', '2025-10-28 10:05:00', '2025-10-28 10:05:00', 0, '2025-10-28 09:57:00', '緊急', NULL),
('a0000003-0000-0000-0000-000000000003', '高橋', 1, 'A小学校の体育館裏、土砂が崩れそうです。危険です。', 35.1702, 136.9002, 0, '2025-10-28 10:10:00', '2025-10-28 10:10:00', '2025-10-28 10:10:00', 0, '2025-10-28 10:05:00', '緊急', NULL),
('a0000004-0000-0000-0000-000000000004', '田中', 3, 'C公民館、ペット（犬）は入れますか？', 35.1801, 136.9201, 0, '2025-10-28 10:15:00', '2025-10-28 10:15:00', '2025-10-28 10:15:00', 0, '2025-10-28 10:00:00', '通常', NULL),
('a0000005-0000-0000-0000-000000000005', '伊藤', 5, 'E福祉センター、食料の配布が始まりました。', 35.1401, 136.9301, 0, '2025-10-28 10:20:00', '2025-10-28 10:20:00', '2025-10-28 10:20:00', 0, '2025-10-28 10:10:00', '通常', NULL),
('a0000006-0000-0000-0000-000000000006', '渡辺', 10, 'J地区会館の状況知りたいです。', 35.1101, 136.9201, 0, '2025-10-28 10:25:00', '2025-10-28 10:25:00', '2025-10-28 10:25:00', 0, '2025-10-28 10:12:00', '重要', NULL),
('a0000007-0000-0000-0000-000000000007', '山本', 8, 'H生涯学習センター、Wi-Fi使えます。パスワードは「bousai」です。', 35.1401, 136.8701, 0, '2025-10-28 10:30:00', '2025-10-28 10:30:00', '2025-10-28 10:30:00', 0, '2025-10-28 10:20:00', '通常', NULL),
('a0000008-0000-0000-0000-000000000008', '中村', 4, 'D大学、赤ちゃん用のミルクあります。必要な方どうぞ。', 35.1501, 136.9501, 0, '2025-10-28 10:35:00', '2025-10-28 10:35:00', '2025-10-28 10:35:00', 0, '2025-10-28 10:25:00', '通常', NULL),
('a0000009-0000-0000-0000-000000000009', '小林', 2, 'B中学校、かなり寒いです。暖房ありません。', 35.1692, 136.8802, 0, '2025-10-28 10:40:00', '2025-10-28 10:40:00', '2025-10-28 10:40:00', 0, '2025-10-28 10:30:00', '重要', NULL),
('a0000010-0000-0000-0000-000000000010', '加藤', 7, 'Gコミュニティセンター、電気が復旧しました！', 35.1201, 136.9101, 0, '2025-10-28 10:45:00', '2025-10-28 10:45:00', '2025-10-28 10:45:00', 0, '2025-10-28 10:35:00', '通常', NULL),
('a0000011-0000-0000-0000-000000000011', 'テスト', 1, 'フリーチャットのサンプル投稿です。', 35.1701, 136.9001, 0, '2025-10-28 10:50:00', '2025-10-28 10:50:00', '2025-10-28 10:50:00', 1, NULL, '通常', NULL);

-- 3. メディアファイルテーブル
INSERT OR IGNORE INTO media (id, post_id, file_path, media_type, file_name, url, created_at, updated_at, deleted_at, is_synced) VALUES
('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'public/uploads/image_01.jpg', 'image/jpeg', 'A小学校の様子.jpg', NULL, '2025-10-28 10:00:10', '2025-10-28 10:00:10', NULL, 0),
('b0000002-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'public/uploads/image_02.jpg', 'image/jpeg', '水の備蓄.jpg', NULL, '2025-10-28 10:00:20', '2025-10-28 10:00:20', NULL, 0),
('b0000003-0000-0000-0000-000000000003', 'a0000002-0000-0000-0000-000000000002', 'public/uploads/image_03.jpg', 'image/jpeg', '混雑状況.jpg', NULL, '2025-10-28 10:05:10', '2025-10-28 10:05:10', NULL, 0),
('b0000004-0000-0000-0000-000000000004', 'a0000003-0000-0000-0000-000000000003', 'public/uploads/image_04.jpg', 'image/jpeg', '体育館裏.jpg', NULL, '2025-10-28 10:10:10', '2025-10-28 10:10:10', NULL, 0),
('b0000005-0000-0000-0000-000000000005', 'a0000003-0000-0000-0000-000000000003', 'public/uploads/video_01.mp4', 'video/mp4', '崩れそうな場所.mp4', NULL, '2025-10-28 10:10:30', '2025-10-28 10:10:30', NULL, 0),
('b0000006-0000-0000-0000-000000000006', 'a0000005-0000-0000-0000-000000000005', 'public/uploads/image_05.jpg', 'image/jpeg', '配布の列.jpg', NULL, '2025-10-28 10:20:10', '2025-10-28 10:20:10', NULL, 0),
('b0000007-0000-0000-0000-000000000007', 'a0000007-0000-0000-0000-000000000007', 'public/uploads/image_06.png', 'image/png', 'wifi_ssid.png', NULL, '2025-10-28 10:30:10', '2025-10-28 10:30:10', NULL, 0),
('b0000008-0000-0000-0000-000000000008', 'a0000008-0000-0000-0000-000000000008', 'public/uploads/image_07.jpg', 'image/jpeg', 'ミルクの写真.jpg', NULL, '2025-10-28 10:35:10', '2025-10-28 10:35:10', NULL, 0),
('b0000009-0000-0000-0000-000000000009', 'a0000009-0000-0000-0000-000000000009', 'public/uploads/image_08.jpg', 'image/jpeg', '温度計.jpg', NULL, '2025-10-28 10:40:10', '2025-10-28 10:40:10', NULL, 0),
('b0000010-0000-0000-0000-000000000010', 'a0000010-0000-0000-0000-000000000010', 'public/uploads/image_09.jpg', 'image/jpeg', '電気がついた.jpg', NULL, '2025-10-28 10:45:10', '2025-10-28 10:45:10', NULL, 0);

-- 4. コメントテーブル
INSERT OR IGNORE INTO comments (id, post_id, author_name, content, status, created_at, updated_at, deleted_at, is_synced) VALUES
('c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', '伊藤', '情報ありがとうございます！今から向かいます。', '未対応', '2025-10-28 11:00:00', '2025-10-28 11:00:00', NULL, 0),
('c0000002-0000-0000-0000-000000000002', 'a0000002-0000-0000-0000-000000000002', '加藤', '私もB中にいますが、本当に寒いです。子供が震えています。', '対応中', '2025-10-28 11:01:00', '2025-10-28 11:01:00', NULL, 0),
('c0000003-0000-0000-0000-000000000003', 'a0000002-0000-0000-0000-000000000002', '佐藤', 'カイロなら少し持っています。どこにいますか？', '未対応', '2025-10-28 11:05:00', '2025-10-28 11:05:00', NULL, 0),
('c0000004-0000-0000-0000-000000000004', 'a0000003-0000-0000-0000-000000000003', '運営（市役所）', '危険な場所には近づかないでください！職員が確認に向かいます。', '解決済み', '2025-10-28 11:10:00', '2025-10-28 11:10:00', NULL, 0),
('c0000005-0000-0000-0000-000000000005', 'a0000004-0000-0000-0000-000000000004', '山本', 'C公民館、先ほど確認したら小型犬ならケージ必須とのことでした。', '解決済み', '2025-10-28 11:15:00', '2025-10-28 11:15:00', NULL, 0),
('c0000006-0000-0000-0000-000000000006', 'a0000004-0000-0000-0000-000000000004', '田中', 'ありがとうございます！助かります。', '解決済み', '2025-10-28 11:16:00', '2025-10-28 11:16:00', NULL, 0),
('c0000007-0000-0000-0000-000000000007', 'a0000006-0000-0000-0000-000000000006', '近藤', 'J地区会館、まだ開設されてないようです。', '対応中', '2025-10-28 11:20:00', '2025-10-28 11:20:00', NULL, 0),
('c0000008-0000-0000-0000-000000000008', 'a0000007-0000-0000-0000-000000000007', '鈴木', 'パスワード助かります！', '未対応', '2025-10-28 11:30:00', '2025-10-28 11:30:00', NULL, 0),
('c0000009-0000-0000-0000-000000000009', 'a0000008-0000-0000-0000-000000000008', '高橋', '助かります！何人分くらいありますか？', '未対応', '2025-10-28 11:35:00', '2025-10-28 11:35:00', NULL, 0),
('c0000010-0000-0000-0000-000000000010', 'a0000010-0000-0000-0000-000000000010', '中村', 'よかった！安心しました。', '解決済み', '2025-10-28 11:45:00', '2025-10-28 11:45:00', NULL, 0),
('c0000011-0000-0000-0000-000000000011', 'a0000011-0000-0000-0000-000000000011', 'あ', '情報ありがとうございます！今から向かいます。', '未対応', '2025-10-28 11:00:00', '2025-10-28 11:00:00', NULL, 0),
('c0000012-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000001', '伊藤', '情報ありがとうございます！今から向かいます。', '対応中', '2025-10-28 11:00:00', '2025-10-28 11:00:00', NULL, 0),
('c0000013-0000-0000-0000-000000000013', 'a0000011-0000-0000-0000-000000000011', 'あ', '情報ありがとうございます！今から向かいます。', '未対応', '2025-10-28 11:00:00', '2025-10-28 11:00:00', NULL, 0);

-- 5. 位置情報トラック（時系列）
INSERT OR IGNORE INTO post_location_tracks (id, post_id, recorded_at, latitude, longitude, created_at, updated_at, deleted_at, is_synced) VALUES
('l0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', '2025-10-28 09:59:00', 35.1700, 136.8998, '2025-10-28 10:00:05', '2025-10-28 10:00:05', NULL, 0),
('l0000002-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', '2025-10-28 09:59:30', 35.1701, 136.9000, '2025-10-28 10:00:05', '2025-10-28 10:00:05', NULL, 0),
('l0000003-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003', '2025-10-28 10:09:00', 35.1702, 136.9001, '2025-10-28 10:10:05', '2025-10-28 10:10:05', NULL, 0);
