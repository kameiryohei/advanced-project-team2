import type { Database } from "../db/database";

// 未同期の投稿データ型
export type UnsyncedPost = {
	id: string;
	author_name: string;
	shelter_id: number;
	content: string | null;
	latitude: number;
	longitude: number;
	posted_at: string;
	created_at: string;
	updated_at: string;
	is_free_chat: number;
	status: string | null;
};

// 未同期のコメントデータ型
export type UnsyncedComment = {
	id: string;
	post_id: string;
	author_name: string;
	content: string;
	status: string;
	created_at: string;
	updated_at: string;
};

// 未同期の位置情報トラックデータ型
export type UnsyncedLocationTrack = {
	id: string;
	post_id: string;
	recorded_at: string;
	latitude: number;
	longitude: number;
	created_at: string;
	updated_at: string;
};

// 同期統計型
export type SyncStats = {
	unsyncedPosts: number;
	unsyncedComments: number;
	unsyncedLocationTracks: number;
	totalUnsynced: number;
	lastSyncAt: string | null;
	lastSyncStatus: string | null;
};

// 同期ログ型
export type SyncLog = {
	id: number;
	shelter_id: number | null;
	sync_type: string;
	status: string;
	started_at: string;
	completed_at: string | null;
	posts_synced: number;
	comments_synced: number;
	location_tracks_synced: number;
	error_message: string | null;
	target_url: string | null;
};

// 同期ログと避難所情報を結合した型
export type SyncLogWithShelter = SyncLog & {
	shelter_name: string | null;
};

// ページネーション付き同期ログ型
export type SyncLogsPaginated = {
	logs: SyncLogWithShelter[];
	totalCount: number;
	page: number;
	limit: number;
	totalPages: number;
};

// 同期結果型
export type SyncResult = {
	success: boolean;
	postsSynced: number;
	commentsSynced: number;
	locationTracksSynced: number;
	errorMessage?: string;
};

// 同期データ受信型（本番側で使用）
export type SyncReceiveData = {
	posts: UnsyncedPost[];
	comments: UnsyncedComment[];
	locationTracks: UnsyncedLocationTrack[];
	sourceUrl?: string;
};

// 避難所ごとの同期結果型
export type ShelterSyncResult = {
	shelterId: number;
	success: boolean;
	postsSynced: number;
	commentsSynced: number;
	locationTracksSynced: number;
	errorMessage?: string;
};

/**
 * 未同期の投稿を取得
 */
async function fetchUnsyncedPosts(db: Database): Promise<UnsyncedPost[]> {
	const query = `
		SELECT 
			id, author_name, shelter_id, content, latitude, longitude,
			posted_at, created_at, updated_at, is_free_chat, status
		FROM posts
		WHERE is_synced = 0 AND deleted_at IS NULL
		ORDER BY created_at ASC
	`;
	const result = await db.prepare(query).all<UnsyncedPost>();
	return result.results || [];
}

/**
 * 未同期のコメントを取得
 */
async function fetchUnsyncedComments(db: Database): Promise<UnsyncedComment[]> {
	const query = `
		SELECT 
			id, post_id, author_name, content, status, created_at, updated_at
		FROM comments
		WHERE is_synced = 0 AND deleted_at IS NULL
		ORDER BY created_at ASC
	`;
	const result = await db.prepare(query).all<UnsyncedComment>();
	return result.results || [];
}

/**
 * 未同期の位置情報トラックを取得
 */
async function fetchUnsyncedLocationTracks(
	db: Database,
): Promise<UnsyncedLocationTrack[]> {
	const query = `
		SELECT 
			id, post_id, recorded_at, latitude, longitude, created_at, updated_at
		FROM post_location_tracks
		WHERE is_synced = 0 AND deleted_at IS NULL
		ORDER BY created_at ASC
	`;
	const result = await db.prepare(query).all<UnsyncedLocationTrack>();
	return result.results || [];
}

/**
 * 投稿の同期フラグを更新
 */
async function markPostsAsSynced(
	db: Database,
	postIds: string[],
): Promise<void> {
	if (postIds.length === 0) return;

	const placeholders = postIds.map(() => "?").join(",");
	const query = `UPDATE posts SET is_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
	await db
		.prepare(query)
		.bind(...postIds)
		.run();
}

/**
 * コメントの同期フラグを更新
 */
async function markCommentsAsSynced(
	db: Database,
	commentIds: string[],
): Promise<void> {
	if (commentIds.length === 0) return;

	const placeholders = commentIds.map(() => "?").join(",");
	const query = `UPDATE comments SET is_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
	await db
		.prepare(query)
		.bind(...commentIds)
		.run();
}

/**
 * 位置情報トラックの同期フラグを更新
 */
async function markLocationTracksAsSynced(
	db: Database,
	trackIds: string[],
): Promise<void> {
	if (trackIds.length === 0) return;

	const placeholders = trackIds.map(() => "?").join(",");
	const query = `UPDATE post_location_tracks SET is_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
	await db
		.prepare(query)
		.bind(...trackIds)
		.run();
}

/**
 * 同期統計を取得
 */
async function getSyncStats(db: Database): Promise<SyncStats> {
	// 未同期件数を取得
	const postsCountQuery = `SELECT COUNT(*) as count FROM posts WHERE is_synced = 0 AND deleted_at IS NULL`;
	const commentsCountQuery = `SELECT COUNT(*) as count FROM comments WHERE is_synced = 0 AND deleted_at IS NULL`;
	const tracksCountQuery = `SELECT COUNT(*) as count FROM post_location_tracks WHERE is_synced = 0 AND deleted_at IS NULL`;

	// 最新の同期ログを取得
	const lastSyncQuery = `
		SELECT started_at, status 
		FROM sync_logs 
		WHERE status = 'completed' 
		ORDER BY started_at DESC 
		LIMIT 1
	`;

	const [postsResult, commentsResult, tracksResult, lastSyncResult] =
		await Promise.all([
			db.prepare(postsCountQuery).first<{ count: number }>(),
			db.prepare(commentsCountQuery).first<{ count: number }>(),
			db.prepare(tracksCountQuery).first<{ count: number }>(),
			db.prepare(lastSyncQuery).first<{ started_at: string; status: string }>(),
		]);

	const unsyncedPosts = postsResult?.count || 0;
	const unsyncedComments = commentsResult?.count || 0;
	const unsyncedLocationTracks = tracksResult?.count || 0;

	return {
		unsyncedPosts,
		unsyncedComments,
		unsyncedLocationTracks,
		totalUnsynced: unsyncedPosts + unsyncedComments + unsyncedLocationTracks,
		lastSyncAt: lastSyncResult?.started_at || null,
		lastSyncStatus: lastSyncResult?.status || null,
	};
}

/**
 * 同期ログを作成
 */
async function createSyncLog(
	db: Database,
	syncType: string,
	targetUrl: string,
	shelterId?: number | null,
): Promise<number> {
	const query = `
		INSERT INTO sync_logs (shelter_id, sync_type, status, target_url)
		VALUES (?, ?, 'in_progress', ?)
	`;
	const result = await db
		.prepare(query)
		.bind(shelterId || null, syncType, targetUrl)
		.run();
	return result.meta.last_row_id as number;
}

/**
 * 同期ログを更新（成功）
 */
async function completeSyncLog(
	db: Database,
	logId: number,
	postsSynced: number,
	commentsSynced: number,
	locationTracksSynced: number,
): Promise<void> {
	const query = `
		UPDATE sync_logs 
		SET status = 'completed', 
			completed_at = CURRENT_TIMESTAMP,
			posts_synced = ?,
			comments_synced = ?,
			location_tracks_synced = ?
		WHERE id = ?
	`;
	await db
		.prepare(query)
		.bind(postsSynced, commentsSynced, locationTracksSynced, logId)
		.run();
}

/**
 * 同期ログを更新（失敗）
 */
async function failSyncLog(
	db: Database,
	logId: number,
	errorMessage: string,
): Promise<void> {
	const query = `
		UPDATE sync_logs 
		SET status = 'failed', 
			completed_at = CURRENT_TIMESTAMP,
			error_message = ?
		WHERE id = ?
	`;
	await db.prepare(query).bind(errorMessage, logId).run();
}

/**
 * 投稿を挿入（本番側で使用、重複スキップ）
 */
async function insertPostIfNotExists(
	db: Database,
	post: UnsyncedPost,
): Promise<boolean> {
	// 既存チェック
	const existsQuery = `SELECT id FROM posts WHERE id = ?`;
	const exists = await db.prepare(existsQuery).bind(post.id).first();
	if (exists) {
		return false; // 既に存在
	}

	const insertQuery = `
		INSERT INTO posts (
			id, author_name, shelter_id, content, latitude, longitude,
			posted_at, created_at, updated_at, is_free_chat, status, is_synced
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
	`;
	await db
		.prepare(insertQuery)
		.bind(
			post.id,
			post.author_name,
			post.shelter_id,
			post.content,
			post.latitude,
			post.longitude,
			post.posted_at,
			post.created_at,
			post.updated_at,
			post.is_free_chat,
			post.status,
		)
		.run();
	return true;
}

/**
 * コメントを挿入（本番側で使用、重複スキップ）
 */
async function insertCommentIfNotExists(
	db: Database,
	comment: UnsyncedComment,
): Promise<boolean> {
	// 既存チェック
	const existsQuery = `SELECT id FROM comments WHERE id = ?`;
	const exists = await db.prepare(existsQuery).bind(comment.id).first();
	if (exists) {
		return false;
	}

	const insertQuery = `
		INSERT INTO comments (
			id, post_id, author_name, content, status, created_at, updated_at, is_synced
		) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
	`;
	await db
		.prepare(insertQuery)
		.bind(
			comment.id,
			comment.post_id,
			comment.author_name,
			comment.content,
			comment.status,
			comment.created_at,
			comment.updated_at,
		)
		.run();
	return true;
}

/**
 * 位置情報トラックを挿入（本番側で使用、重複スキップ）
 */
async function insertLocationTrackIfNotExists(
	db: Database,
	track: UnsyncedLocationTrack,
): Promise<boolean> {
	// 既存チェック
	const existsQuery = `SELECT id FROM post_location_tracks WHERE id = ?`;
	const exists = await db.prepare(existsQuery).bind(track.id).first();
	if (exists) {
		return false;
	}

	const insertQuery = `
		INSERT INTO post_location_tracks (
			id, post_id, recorded_at, latitude, longitude, created_at, updated_at, is_synced
		) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
	`;
	await db
		.prepare(insertQuery)
		.bind(
			track.id,
			track.post_id,
			track.recorded_at,
			track.latitude,
			track.longitude,
			track.created_at,
			track.updated_at,
		)
		.run();
	return true;
}

/**
 * 同期データを受信して挿入（本番側で使用）
 */
async function receiveAndInsertSyncData(
	db: Database,
	data: SyncReceiveData,
): Promise<SyncResult> {
	let postsInserted = 0;
	let commentsInserted = 0;
	let tracksInserted = 0;

	try {
		// 投稿を挿入
		for (const post of data.posts) {
			const inserted = await insertPostIfNotExists(db, post);
			if (inserted) postsInserted++;
		}

		// コメントを挿入（投稿が存在する場合のみ）
		for (const comment of data.comments) {
			const inserted = await insertCommentIfNotExists(db, comment);
			if (inserted) commentsInserted++;
		}

		// 位置情報トラックを挿入（投稿が存在する場合のみ）
		for (const track of data.locationTracks) {
			const inserted = await insertLocationTrackIfNotExists(db, track);
			if (inserted) tracksInserted++;
		}

		return {
			success: true,
			postsSynced: postsInserted,
			commentsSynced: commentsInserted,
			locationTracksSynced: tracksInserted,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			postsSynced: postsInserted,
			commentsSynced: commentsInserted,
			locationTracksSynced: tracksInserted,
			errorMessage: message,
		};
	}
}

/**
 * 受信データを避難所ごとにグループ化
 */
function groupDataByShelter(
	data: SyncReceiveData,
): Map<number, SyncReceiveData> {
	const grouped = new Map<number, SyncReceiveData>();

	// post_id → shelter_id のマッピングを作成
	const postIdToShelterId = new Map<string, number>();
	for (const post of data.posts) {
		postIdToShelterId.set(post.id, post.shelter_id);
	}

	// 投稿を避難所ごとにグループ化
	for (const post of data.posts) {
		if (!grouped.has(post.shelter_id)) {
			grouped.set(post.shelter_id, {
				posts: [],
				comments: [],
				locationTracks: [],
				sourceUrl: data.sourceUrl,
			});
		}
		const group = grouped.get(post.shelter_id);
		if (group) {
			group.posts.push(post);
		}
	}

	// コメントを避難所ごとに振り分け
	for (const comment of data.comments) {
		const shelterId = postIdToShelterId.get(comment.post_id);
		if (shelterId !== undefined && grouped.has(shelterId)) {
			const group = grouped.get(shelterId);
			if (group) {
				group.comments.push(comment);
			}
		} else {
			console.warn(
				`[groupDataByShelter] コメントID ${comment.id} の投稿ID ${comment.post_id} が見つかりません。スキップします。`,
			);
		}
	}

	// 位置情報トラックを避難所ごとに振り分け
	for (const track of data.locationTracks) {
		const shelterId = postIdToShelterId.get(track.post_id);
		if (shelterId !== undefined && grouped.has(shelterId)) {
			const group = grouped.get(shelterId);
			if (group) {
				group.locationTracks.push(track);
			}
		} else {
			console.warn(
				`[groupDataByShelter] 位置情報ID ${track.id} の投稿ID ${track.post_id} が見つかりません。スキップします。`,
			);
		}
	}

	return grouped;
}

/**
 * 同期ログ一覧を取得（ページネーション対応）
 */
async function fetchSyncLogs(
	db: Database,
	shelterId?: number,
	page = 1,
	limit = 10,
): Promise<SyncLogsPaginated> {
	// ページ番号は1から開始、オフセット計算は0から
	const offset = (page - 1) * limit;

	// フィルタ条件の構築
	const whereClause = shelterId ? "WHERE sync_logs.shelter_id = ?" : "";
	const bindParams = shelterId ? [shelterId] : [];

	// 総件数取得
	const countQuery = `
		SELECT COUNT(*) as count
		FROM sync_logs
		${whereClause}
	`;
	const countResult = await db
		.prepare(countQuery)
		.bind(...bindParams)
		.first<{ count: number }>();
	const totalCount = countResult?.count || 0;
	const totalPages = Math.ceil(totalCount / limit);

	// ログ一覧取得（避難所名も結合）
	const logsQuery = `
		SELECT 
			sync_logs.id,
			sync_logs.shelter_id,
			shelters.name as shelter_name,
			sync_logs.sync_type,
			sync_logs.status,
			sync_logs.started_at,
			sync_logs.completed_at,
			sync_logs.posts_synced,
			sync_logs.comments_synced,
			sync_logs.location_tracks_synced,
			sync_logs.error_message,
			sync_logs.target_url
		FROM sync_logs
		LEFT JOIN shelters ON sync_logs.shelter_id = shelters.id
		${whereClause}
		ORDER BY sync_logs.started_at DESC
		LIMIT ? OFFSET ?
	`;
	const logsResult = await db
		.prepare(logsQuery)
		.bind(...bindParams, limit, offset)
		.all<SyncLogWithShelter>();

	return {
		logs: logsResult.results || [],
		totalCount,
		page,
		limit,
		totalPages,
	};
}

export const syncRepository = {
	fetchUnsyncedPosts,
	fetchUnsyncedComments,
	fetchUnsyncedLocationTracks,
	markPostsAsSynced,
	markCommentsAsSynced,
	markLocationTracksAsSynced,
	getSyncStats,
	createSyncLog,
	completeSyncLog,
	failSyncLog,
	insertPostIfNotExists,
	insertCommentIfNotExists,
	insertLocationTrackIfNotExists,
	receiveAndInsertSyncData,
	fetchSyncLogs,
	groupDataByShelter,
};
