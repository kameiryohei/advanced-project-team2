import type { components } from "../../schema/schema";
import type { Database } from "../db/database";

type PostMediaItem = components["schemas"]["PostMediaItem"];

type InsertableMediaItem = PostMediaItem & {
	id: string;
	file_path: string;
	created_at?: string;
};

type ShelterCountRow = {
	shelterCount: number;
};

interface Shelter {
	id: number;
	name: string;
	address: string | null;
	latitude: number | null;
	longitude: number | null;
}

export type ShelterPostSummary = {
	id: string;
	author_name: string;
	content: string | null;
	posted_at: string;
	shelter_name: string;
	comment_count: number;
};

export type ShelterDetails = {
	id: number;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	created_at: string;
};

export type ShelterPosts = {
	postId: string;
	authorName: string;
	shelterId: number;
	content: string | null;
	postedAt: string;
	latitude: number;
	longitude: number;
	is_synced: number;
	createdAtByPost: string;
	is_free_chat: number;
	status: "緊急" | "重要" | "通常" | null;
	mediaId: string | null;
	filePath: string | null;
	mediaType: string | null;
	fileName: string | null;
	createdAtByMedia: string | null;
};

export type NewCommentResult = {
	id: string;
	postId: string;
	authorName: string;
	content: string;
	createdAt: string;
	status: "未対応" | "対応中" | "対応済み" | null;
};

const normalizePostStatus = (
	status: string | null,
): "緊急" | "重要" | "通常" | null => {
	if (status === "緊急" || status === "重要" || status === "通常") {
		return status;
	}
	return null;
};

const normalizeCommentStatus = (
	status: string | null,
): "未対応" | "対応中" | "対応済み" | null => {
	if (!status) return null;
	if (status === "未対応" || status === "対応中" || status === "対応済み") {
		return status;
	}
	if (status === "解決済み") {
		return "対応済み";
	}
	return null;
};

const recentPostsByShelterQuery = `SELECT
	p.id,
	p.author_name,
	p.content,
	p.posted_at,
	s.name AS shelter_name,
	COUNT(c.id) AS comment_count
FROM posts AS p
INNER JOIN shelters AS s ON p.shelter_id = s.id
LEFT JOIN comments AS c ON c.post_id = p.id
WHERE p.shelter_id = ?
GROUP BY
	p.id,
	p.author_name,
	p.content,
	p.posted_at,
	s.name
ORDER BY p.posted_at DESC
LIMIT 5`;

export const countShelters = async (db: Database): Promise<number> => {
	const { results } = await db
		.prepare("SELECT COUNT(*) AS shelterCount FROM shelters")
		.all<ShelterCountRow>();

	return results[0]?.shelterCount ?? 0;
};

export const fetchShelterDetails = async (
	db: Database,
	shelterId: number,
): Promise<ShelterDetails> => {
	const { results } = await db
		.prepare("SELECT * FROM shelters WHERE id = ?")
		.bind(shelterId)
		.all<ShelterDetails>();
	return results[0];
};

export const getShelterList = async (db: Database): Promise<Shelter[]> => {
	const { results } = await db
		.prepare("SELECT id, name, address, latitude, longitude FROM shelters;")
		.all<Shelter>();
	return results ?? [];
};

export const fetchRecentPostsByShelter = async (
	db: Database,
	shelterId: number,
): Promise<ShelterPostSummary[]> => {
	const { results } = await db
		.prepare(recentPostsByShelterQuery)
		.bind(shelterId)
		.all<ShelterPostSummary>();

	return results;
};

export class ShelterNotFoundError extends Error {
	constructor(id: number) {
		super(`Shelter not found: ${id}`);
		this.name = "ShelterNotFoundError";
	}
}

export const insertShelterPost = async (
	db: Database,
	post: ShelterPosts,
	mediaItems?: PostMediaItem[],
): Promise<void> => {
	// check shelter exists
	const shelterCheck = await db
		.prepare("SELECT id FROM shelters WHERE id = ?")
		.bind(post.shelterId)
		.all<{ id: number }>();

	if (!shelterCheck.results || shelterCheck.results.length === 0) {
		throw new ShelterNotFoundError(post.shelterId);
	}

	// insert into posts, then media (if any). If media insert fails, remove the post to avoid partial state.
	try {
		await db
			.prepare(
				`INSERT INTO posts (id, author_name, shelter_id, content, latitude, longitude, is_synced, posted_at, created_at, is_free_chat, status)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				post.postId,
				post.authorName,
				post.shelterId,
				post.content,
				post.latitude,
				post.longitude,
				post.is_synced,
				post.postedAt,
				post.createdAtByPost,
				post.is_free_chat,
				post.status,
			)
			.run();

		// if media items provided, insert each into media table referencing the same post id
		if (mediaItems && Array.isArray(mediaItems) && mediaItems.length > 0) {
			try {
				for (const miRaw of mediaItems) {
					const mi = miRaw as InsertableMediaItem;
					const id = mi.id;
					const file_path = mi.file_path;
					const media_type = mi.mediaType;
					const file_name = mi.fileName ?? null;
					const created_at = mi.created_at ?? new Date().toISOString();

					await db
						.prepare(
							`INSERT INTO media (id, post_id, file_path, media_type, file_name, created_at)
						VALUES (?, ?, ?, ?, ?, ?)`,
						)
						.bind(id, post.postId, file_path, media_type, file_name, created_at)
						.run();
				}
			} catch (mediaErr) {
				// cleanup any media for this post and the post itself to avoid partial insertion
				try {
					await db
						.prepare("DELETE FROM media WHERE post_id = ?")
						.bind(post.postId)
						.run();
				} catch (cleanupMediaErr) {
					console.error(
						"Failed to cleanup media after media insert error",
						cleanupMediaErr,
					);
				}

				try {
					await db
						.prepare("DELETE FROM posts WHERE id = ?")
						.bind(post.postId)
						.run();
				} catch (cleanupErr) {
					console.error(
						"Failed to cleanup post after media insert error",
						cleanupErr,
					);
				}

				const msg =
					mediaErr instanceof Error ? mediaErr.message : String(mediaErr);
				if (msg.includes("FOREIGN KEY") || msg.includes("SQLITE_CONSTRAINT")) {
					throw new Error(
						"Media insert failed: referenced post or other FK target not found",
					);
				}

				throw mediaErr;
			}
		}
	} catch (err) {
		// If the post insert failed due to shelter FK (shelter_id), translate to ShelterNotFoundError
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes("FOREIGN KEY") || msg.includes("SQLITE_CONSTRAINT")) {
			// check shelter again to give a helpful error
			const shelterCheck2 = await db
				.prepare("SELECT id FROM shelters WHERE id = ?")
				.bind(post.shelterId)
				.all<{ id: number }>();
			if (!shelterCheck2.results || shelterCheck2.results.length === 0) {
				throw new ShelterNotFoundError(post.shelterId);
			}
		}

		throw err;
	}
};

export const createCommentForPost = async (
	db: Database,
	{
		commentId,
		postId,
		authorName,
		content,
		status,
	}: {
		commentId: string;
		postId: string;
		authorName: string;
		content: string;
		status?: "未対応" | "対応中" | "対応済み" | null;
	},
): Promise<NewCommentResult> => {
	const createdAt = new Date().toISOString();
	const normalizedStatus = normalizeCommentStatus(status ?? null) ?? "未対応";

	const result = await db
		.prepare(
			`
      INSERT INTO comments (id, post_id, author_name, content, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING
        id,
        post_id AS postId,
        author_name AS authorName,
        content,
        status,
        created_at AS createdAt
    `,
		)
		.bind(commentId, postId, authorName, content, normalizedStatus, createdAt)
		.first<NewCommentResult>();

	if (!result) {
		throw new Error("Insert failed");
	}

	return {
		...result,
		id: String(result.id),
		postId: String(result.postId),
		status: normalizeCommentStatus(result.status),
	};
};

/**
 * 投稿に紐づく位置情報トラックをpost_location_tracksテーブルに一括挿入する
 */
export const insertLocationTracks = async (
	db: Database,
	postId: string,
	tracks: Array<{
		id: string;
		recordedAt: string;
		latitude: number;
		longitude: number;
	}>,
): Promise<void> => {
	if (tracks.length === 0) {
		return;
	}

	const now = new Date().toISOString();

	for (const track of tracks) {
		await db
			.prepare(
				`INSERT INTO post_location_tracks (id, post_id, recorded_at, latitude, longitude, created_at)
			VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				track.id,
				postId,
				track.recordedAt,
				track.latitude,
				track.longitude,
				now,
			)
			.run();
	}
};

export const fetchCommentsByPost = async (
	db: Database,
	postId: string,
): Promise<
	Array<{
		id: string;
		authorName: string;
		content: string;
		createdAt: string;
		status: "未対応" | "対応中" | "対応済み" | null;
	}>
> => {
	const { results } = await db
		.prepare(
			`SELECT id, author_name AS authorName, content, created_at AS createdAt, status
			 FROM comments
			 WHERE post_id = ? AND deleted_at IS NULL
			 ORDER BY created_at ASC`,
		)
		.bind(postId)
		.all<{
			id: string;
			authorName: string;
			content: string;
			createdAt: string;
			status: string | null;
		}>();

	return (
		results?.map((row) => ({
			...row,
			status: normalizeCommentStatus(row.status),
		})) ?? []
	);
};

export const fetchPostIsFreeChat = async (
	db: Database,
	postId: string,
): Promise<{
	isFreeChat: number;
	status: "緊急" | "重要" | "通常" | null;
} | null> => {
	const row = await db
		.prepare("SELECT is_free_chat, status FROM posts WHERE id = ?")
		.bind(postId)
		.first<{ is_free_chat: number; status: string | null }>();

	if (!row) return null;

	return {
		isFreeChat: row.is_free_chat ?? 0,
		status: normalizePostStatus(row.status),
	};
};

/**
 * 投稿詳細情報の型
 */
export type PostDetailRow = {
	id: string;
	shelterId: number;
	shelterName: string;
	authorName: string;
	content: string | null;
	postedAt: string;
	latitude: number;
	longitude: number;
	isFreeChat: number;
	commentCount: number;
};

export type MediaRow = {
	id: string;
	filePath: string;
	mediaType: string;
	fileName: string | null;
};

export type LocationTrackRow = {
	recordedAt: string;
	latitude: number;
	longitude: number;
};

/**
 * 投稿IDから投稿の詳細情報を取得する
 */
export const fetchPostById = async (
	db: Database,
	postId: string,
): Promise<{
	post: PostDetailRow;
	media: MediaRow[];
	locationTrack: LocationTrackRow[];
} | null> => {
	// 投稿の基本情報とコメント数を取得
	const postRow = await db
		.prepare(
			`SELECT
				p.id,
				p.shelter_id AS shelterId,
				s.name AS shelterName,
				p.author_name AS authorName,
				p.content,
				p.posted_at AS postedAt,
				p.latitude,
				p.longitude,
				p.is_free_chat AS isFreeChat,
				(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS commentCount
			FROM posts p
			INNER JOIN shelters s ON p.shelter_id = s.id
			WHERE p.id = ?`,
		)
		.bind(postId)
		.first<PostDetailRow>();

	if (!postRow) {
		return null;
	}

	// メディア情報を取得
	const { results: mediaRows } = await db
		.prepare(
			`SELECT
				id,
				file_path AS filePath,
				media_type AS mediaType,
				file_name AS fileName
			FROM media
			WHERE post_id = ?
			ORDER BY created_at ASC`,
		)
		.bind(postId)
		.all<MediaRow>();

	// 位置トラック情報を取得
	const { results: trackRows } = await db
		.prepare(
			`SELECT
				recorded_at AS recordedAt,
				latitude,
				longitude
			FROM post_location_tracks
			WHERE post_id = ?
			ORDER BY recorded_at ASC`,
		)
		.bind(postId)
		.all<LocationTrackRow>();

	return {
		post: postRow,
		media: mediaRows ?? [],
		locationTrack: trackRows ?? [],
	};
};
