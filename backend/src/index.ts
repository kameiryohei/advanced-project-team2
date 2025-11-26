import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { createMiddleware } from "../middleware/middleware";
import type { components, paths } from "../schema/schema";
import type { Bindings } from "./db/database";
import { dbConnect } from "./db/database";
import {
	reverseGeocoderRepository,
	shelterRepository,
	signedVideoRepository,
	videoRepository,
} from "./repositories";
import type { ShelterPosts } from "./repositories/shelterRepository";

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定を含むミドルウェア
app.use("*", (c, next) => {
	const frontendOrigin = c.env.FRONTEND_ORIGIN;
	const middleware = createMiddleware({
		additionalOrigins: frontendOrigin
			? [frontendOrigin]
			: ["http://localhost:5173", "http://localhost:3000"],
	});
	return middleware(c, next);
});

app.get("/", (c) => {
	console.log("Hello Team2!");
	return c.text("Hello Team2!");
});

// 逆ジオコーディングエンドポイント
app.get("/api/geocode/reverse", async (c) => {
	const lat = c.req.query("lat");
	const lon = c.req.query("lon");

	console.log("逆ジオコーディングリクエスト:", { lat, lon });

	if (!lat || !lon) {
		return c.json({ error: "緯度と経度が必要です" }, 400);
	}

	const apiKey = c.env.YAHOO_MAPS_API_KEY;
	console.log("APIキー確認:", { hasApiKey: !!apiKey });

	if (!apiKey) {
		return c.json({ error: "APIキーが設定されていません" }, 500);
	}

	try {
		const data = await reverseGeocoderRepository.reverseGeocoderFetch(
			lat,
			lon,
			apiKey,
		);

		console.log("Yahoo APIレスポンス:", JSON.stringify(data, null, 2));

		if (data.Feature.length === 0) {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "住所が見つかりませんでした",
			};
			return c.json(errorResponse, 404);
		}

		const successResponse: paths["/api/geocode/reverse"]["get"]["responses"]["200"]["content"]["application/json"] =
			data;
		return c.json(successResponse);
	} catch (error) {
		console.error("逆ジオコーディングエラー:", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: `住所の取得に失敗しました: ${message}`,
		};
		return c.json(errorResponse, 500);
	}
});

app.get("/shelters/:id", async (c) => {
	const shelterId = Number.parseInt(c.req.param("id"), 10);

	if (Number.isNaN(shelterId)) {
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: "shelterId must be a number",
		};
		return c.json(errorResponse, 400);
	}

	const db = dbConnect(c.env);

	try {
		const details = await shelterRepository.fetchShelterDetails(db, shelterId);
		if (!details) {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "指定した避難所は見つかりませんでした",
			};
			return c.json(errorResponse, 404);
		}

		const response: paths["/shelters/{id}"]["get"]["responses"]["200"]["content"]["application/json"] =
			details;
		return c.json(response);
	} catch (error) {
		console.error("D1 posts query failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: message,
		};
		return c.json(errorResponse, 500);
	}
});

app.get("/shelters", async (c) => {
	const db = dbConnect(c.env);

	try {
		const [shelterList, shelterCount] = await Promise.all([
			shelterRepository.getShelterList(db),
			shelterRepository.countShelters(db),
		]);
		const response: paths["/shelters"]["get"]["responses"]["200"]["content"]["application/json"] =
			{
				shelterList,
				shelterCount,
			};
		return c.json(response);
	} catch (error) {
		console.error("D1 query failed", error);

		const message = error instanceof Error ? error.message : "Unknown error";
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: message,
		};
		return c.json(errorResponse, 500);
	}
});

app.get("/shelters/:id/posts", async (c) => {
	const shelterId = Number.parseInt(c.req.param("id"), 10);

	if (Number.isNaN(shelterId)) {
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: "shelterId must be a number",
		};
		return c.json(errorResponse, 400);
	}

	const db = dbConnect(c.env);

	try {
		const posts = await shelterRepository.fetchRecentPostsByShelter(
			db,
			shelterId,
		);
		const response: paths["/shelters/{id}/posts"]["get"]["responses"]["200"]["content"]["application/json"] =
			{
				shelterId,
				posts,
			};
		return c.json(response);
	} catch (error) {
		console.error("D1 posts query failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: message,
		};
		return c.json(errorResponse, 500);
	}
});

// 開発環境用: R2から直接ファイルを返すエンドポイント
app.get("/r2/video/:key{.+}", async (c) => {
	const key = c.req.param("key");

	if (!key) {
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: "key is required",
		};
		return c.json(errorResponse, 400);
	}

	const bucket = c.env.ASSET_BUCKET;

	try {
		const object = await bucket.get(key);
		if (!object) {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "Object not found",
			};
			return c.json(errorResponse, 404);
		}

		const headers = new Headers();
		headers.set(
			"Content-Type",
			object.httpMetadata?.contentType || "application/octet-stream",
		);
		headers.set("Content-Length", String(object.size));

		return new Response(object.body, { headers });
	} catch (error) {
		console.error("R2 get failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: message,
		};
		return c.json(errorResponse, 500);
	}
});

app.post("/posts", async (c) => {
	const db = dbConnect(c.env);
	const bucket = c.env.ASSET_BUCKET;

	// ファイルサイズ上限（30MB）
	const MAX_FILE_SIZE = 30 * 1024 * 1024;
	// 許可するMIMEタイプ
	const ALLOWED_MIME_TYPES = [
		"image/jpeg",
		"image/png",
		"image/gif",
		"video/mp4",
	];

	try {
		// multipart/form-data をパース
		const formData = await c.req.formData();

		// metadata フィールドから JSON を取得
		const metadataField = formData.get("metadata");
		if (!metadataField || typeof metadataField !== "string") {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "metadata field is required and must be a JSON string",
			};
			return c.json(errorResponse, 400);
		}

		let reqBody: components["schemas"]["CreatePostRequest"];
		try {
			reqBody = JSON.parse(metadataField);
		} catch {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "metadata field must be valid JSON",
			};
			return c.json(errorResponse, 400);
		}

		if (
			typeof reqBody.shelterId !== "number" ||
			Number.isNaN(reqBody.shelterId)
		) {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "shelterId must be a number",
			};
			return c.json(errorResponse, 400);
		}

		// mediaFiles フィールドからファイルを取得
		const mediaFiles: File[] = [];
		const allMediaFiles = formData.getAll("mediaFiles");
		for (const file of allMediaFiles) {
			if (file instanceof File) {
				mediaFiles.push(file);
			}
		}

		// ファイルサイズとMIMEタイプのバリデーション
		for (const file of mediaFiles) {
			if (file.size > MAX_FILE_SIZE) {
				const errorResponse: components["schemas"]["ErrorResponse"] = {
					error: `File "${file.name}" exceeds maximum size of 50MB`,
				};
				return c.json(errorResponse, 413);
			}

			if (!ALLOWED_MIME_TYPES.includes(file.type)) {
				const errorResponse: components["schemas"]["ErrorResponse"] = {
					error: `File "${file.name}" has unsupported media type: ${file.type}. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
				};
				return c.json(errorResponse, 415);
			}
		}

		const now = new Date().toISOString();
		const postId = uuidv4();

		// locationTrack があれば最初の点を使い、なければ 0 を入れる
		const firstLocation =
			reqBody.locationTrack && reqBody.locationTrack.length > 0
				? reqBody.locationTrack[0]
				: undefined;

		const shelterPost: ShelterPosts = {
			postId,
			authorName: reqBody.authorName,
			shelterId: reqBody.shelterId,
			content: reqBody.content ?? null,
			postedAt: reqBody.occurredAt ?? now,
			latitude: firstLocation ? firstLocation.latitude : 0,
			longitude: firstLocation ? firstLocation.longitude : 0,
			is_synced: 0,
			createdAtByPost: now,
			is_free_chat: 0,
			mediaId: null,
			filePath: null,
			mediaType: null,
			fileName: null,
			createdAtByMedia: null,
		};

		const mediaItems: Array<{
			id: string;
			file_path: string;
			mediaType: string;
			fileName?: string | null;
			created_at?: string;
		}> = [];

		// R2にファイルをアップロード
		const uploadedKeys: string[] = [];
		try {
			for (const file of mediaFiles) {
				const mediaId = uuidv4();

				// ファイル拡張子を取得
				const ext = file.name.split(".").pop() || "";
				const r2Key = `media/${postId}/${mediaId}${ext ? `.${ext}` : ""}`;

				const body = await file.arrayBuffer();

				// R2にアップロード
				await videoRepository.uploadVideo({
					bucket,
					key: r2Key,
					body,
					contentType: file.type,
				});

				uploadedKeys.push(r2Key);

				mediaItems.push({
					id: mediaId,
					file_path: r2Key,
					mediaType: file.type,
					fileName: file.name,
					created_at: now,
				});
			}

			// reqBody.media からもメタデータのみのアイテムを追加（ファイルなしの場合）
			if (
				reqBody.media &&
				Array.isArray(reqBody.media) &&
				reqBody.media.length > 0 &&
				mediaFiles.length === 0
			) {
				for (const mi of reqBody.media) {
					const mediaId = uuidv4();

					const filePath = `media/${postId}/${mediaId}`;

					mediaItems.push({
						id: mediaId,
						file_path: filePath,
						mediaType: mi.mediaType,
						fileName: mi.fileName ?? null,
						created_at: now,
					});
				}
			}
		} catch (uploadErr) {
			// アップロード失敗時は既にアップロードしたファイルを削除
			for (const key of uploadedKeys) {
				try {
					await bucket.delete(key);
				} catch (deleteErr) {
					console.error(`Failed to cleanup R2 object ${key}`, deleteErr);
				}
			}

			if (uploadErr instanceof videoRepository.EmptyVideoBodyError) {
				const errorResponse: components["schemas"]["ErrorResponse"] = {
					error: "Empty file body is not allowed",
				};
				return c.json(errorResponse, 400);
			}

			throw uploadErr;
		}

		try {
			await shelterRepository.insertShelterPost(
				db,
				shelterPost,
				mediaItems.length > 0 ? mediaItems : undefined,
			);

			// locationTrackがあればpost_location_tracksテーブルに保存
			if (
				reqBody.locationTrack &&
				Array.isArray(reqBody.locationTrack) &&
				reqBody.locationTrack.length > 0
			) {
				const trackItems = reqBody.locationTrack.map((pt) => ({
					id: uuidv4(),
					recordedAt: pt.recordedAt,
					latitude: pt.latitude,
					longitude: pt.longitude,
				}));
				await shelterRepository.insertLocationTracks(db, postId, trackItems);
			}
		} catch (err) {
			// DB挿入失敗時はR2からファイルを削除
			for (const key of uploadedKeys) {
				try {
					await bucket.delete(key);
				} catch (deleteErr) {
					console.error(`Failed to cleanup R2 object ${key}`, deleteErr);
				}
			}

			if (err instanceof shelterRepository.ShelterNotFoundError) {
				const errorResponse: components["schemas"]["ErrorResponse"] = {
					error: "指定した避難所は存在しません",
				};
				return c.json(errorResponse, 404);
			}
			throw err;
		}

		// メディアURLを生成（本番は署名付きURL、開発はローカルURL）
		const isDevelopment = c.env.NODE_ENV === "development";
		const mediaResponse: components["schemas"]["MediaItem"][] = [];

		for (const mi of mediaItems) {
			let url: string;
			if (isDevelopment) {
				url = `http://localhost:8787/r2/video/${mi.file_path}`;
			} else {
				// 本番環境: 署名付きURLを生成
				url = await signedVideoRepository.fetchSignedVideo({
					bucketName: c.env.R2_BUCKET_NAME,
					accountId: c.env.CLOUDFLARE_R2_ACCOUNT_ID,
					objectKey: mi.file_path,
					accessKeyId: c.env.R2_ACCESS_KEY_ID,
					secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
				});
			}
			mediaResponse.push({
				mediaId: mi.id,
				mediaType: mi.mediaType,
				fileName: mi.fileName ?? null,
				url,
			});
		}

		const response: paths["/posts"]["post"]["responses"]["201"]["content"]["application/json"] =
			{
				postId,
				media: mediaResponse,
			};

		return c.json(response, 201);
	} catch (error) {
		console.error("D1 insert post failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: message,
		};
		return c.json(errorResponse, 500);
	}
});

// 投稿の詳細を取得
app.get("/posts/:id", async (c) => {
	const postId = c.req.param("id");

	if (!postId) {
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: "post id is required",
		};
		return c.json(errorResponse, 400);
	}

	const db = dbConnect(c.env);
	const isDevelopment = c.env.NODE_ENV === "development";

	try {
		const result = await shelterRepository.fetchPostById(db, postId);

		if (!result) {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "投稿が見つかりません",
			};
			return c.json(errorResponse, 404);
		}

		const { post, media, locationTrack } = result;

		// メディアURLを生成（本番は署名付きURL、開発はローカルURL）
		const mediaItems: components["schemas"]["MediaItem"][] = [];

		for (const mi of media) {
			let url: string;
			if (isDevelopment) {
				url = `http://localhost:8787/r2/video/${mi.filePath}`;
			} else {
				// 本番環境: 署名付きURLを生成
				url = await signedVideoRepository.fetchSignedVideo({
					bucketName: c.env.R2_BUCKET_NAME,
					accountId: c.env.CLOUDFLARE_R2_ACCOUNT_ID,
					objectKey: mi.filePath,
					accessKeyId: c.env.R2_ACCESS_KEY_ID,
					secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
				});
			}
			mediaItems.push({
				mediaId: mi.id,
				mediaType: mi.mediaType,
				fileName: mi.fileName ?? null,
				url,
			});
		}

		const response: paths["/posts/{id}"]["get"]["responses"]["200"]["content"]["application/json"] =
			{
				id: post.id,
				shelterId: post.shelterId,
				shelterName: post.shelterName,
				authorName: post.authorName,
				content: post.content,
				postedAt: post.postedAt,
				media: mediaItems,
				locationTrack: locationTrack.map((lt) => ({
					recordedAt: lt.recordedAt,
					latitude: lt.latitude,
					longitude: lt.longitude,
				})),
				commentCount: post.commentCount,
			};

		return c.json(response);
	} catch (error) {
		console.error("D1 fetch post detail failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: message,
		};
		return c.json(errorResponse, 500);
	}
});

// 投稿に紐づくコメント一覧取得とコメント作成エンドポイント
app.get("/posts/:id/comments", async (c) => {
	const postId = c.req.param("id");

	if (!postId) {
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: "post id is required",
		};
		return c.json(errorResponse, 400);
	}

	const db = dbConnect(c.env);

	try {
		// posts テーブルから is_free_chat を取得（null の場合は投稿が存在しないと見なす）
		const isFreeChatVal = await shelterRepository.fetchPostIsFreeChat(
			db,
			postId,
		);

		if (isFreeChatVal === null) {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "対象の投稿が見つかりません",
			};
			return c.json(errorResponse, 404);
		}

		const isFreeChat = isFreeChatVal === 1;

		const comments = await shelterRepository.fetchCommentsByPost(db, postId);

		const response: paths["/posts/{id}/comments"]["get"]["responses"]["200"]["content"]["application/json"] =
			{
				postId,
				isFreeChat,
				comments,
			};

		return c.json(response);
	} catch (error) {
		console.error("D1 fetch comments failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: message,
		};
		return c.json(errorResponse, 500);
	}
});

app.post("/posts/:id/comments", async (c) => {
	const postId = c.req.param("id");

	if (!postId) {
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: "post id is required",
		};
		return c.json(errorResponse, 400);
	}

	const db = dbConnect(c.env);

	try {
		const reqBody =
			await c.req.json<components["schemas"]["CreateCommentRequest"]>();

		if (
			!reqBody ||
			typeof reqBody.authorName !== "string" ||
			typeof reqBody.content !== "string"
		) {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "invalid request body",
			};
			return c.json(errorResponse, 400);
		}

		const commentId = uuidv4();

		try {
			const result = await shelterRepository.createCommentForPost(db, {
				commentId,
				postId,
				authorName: reqBody.authorName,
				content: reqBody.content,
			});

			const response: paths["/posts/{id}/comments"]["post"]["responses"]["201"]["content"]["application/json"] =
				{
					comment: {
						id: result.id,
						postId: result.postId,
						authorName: result.authorName,
						content: result.content,
						createdAt: result.createdAt,
					},
				};

			return c.json(response, 201);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			// foreign key / sqlite constraint -> post not found
			if (msg.includes("FOREIGN KEY") || msg.includes("SQLITE_CONSTRAINT")) {
				const errorResponse: components["schemas"]["ErrorResponse"] = {
					error: "対象の投稿が見つかりません",
				};
				return c.json(errorResponse, 404);
			}
			throw err;
		}
	} catch (error) {
		console.error("D1 create comment failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: message,
		};
		return c.json(errorResponse, 500);
	}
});

export default app;
