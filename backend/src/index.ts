import { Hono } from "hono";
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

	if (!lat || !lon) {
		return c.json({ error: "緯度と経度が必要です" }, 400);
	}

	const apiKey = c.env.YAHOO_MAPS_API_KEY;
	if (!apiKey) {
		return c.json({ error: "APIキーが設定されていません" }, 500);
	}

	try {
		const data = await reverseGeocoderRepository.reverseGeocoderFetch(
			lat,
			lon,
			apiKey,
		);

		if (data.Feature.length === 0) {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "住所が見つかりませんでした",
			};
			return c.json(errorResponse, 404);
		}

		const successResponse: paths["/api/geocode/reverse"]["get"]["responses"]["200"]["content"]["application/json"] =
			data;
		return c.json(successResponse);
	} catch {
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: "住所の取得に失敗しました",
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

// 動画アップロード・取得用のサンプルエンドポイント
app.post("/r2/test-video/:key", async (c) => {
	const key = c.req.param("key");
	const bucket = c.env.ASSET_BUCKET;
	const contentType =
		c.req.header("content-type") ?? "application/octet-stream";

	try {
		const body = await c.req.arrayBuffer();
		const uploadResult = await videoRepository.uploadVideo({
			bucket,
			key,
			body,
			contentType,
		});

		return c.json(uploadResult);
	} catch (error) {
		if (error instanceof videoRepository.EmptyVideoBodyError) {
			return c.json({ error: error.message }, 400);
		}

		console.error("R2 video put failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return c.json({ error: message }, 500);
	}
});

// サイン付きURL取得用のサンプルエンドポイント
app.get("/r2/test-video/:key", async (c) => {
	const key = c.req.param("key");

	if (!key) {
		return c.json({ error: "key is required" }, 400);
	}

	const bucketName = c.env.R2_BUCKET_NAME;
	const accountId = c.env.CLOUDFLARE_R2_ACCOUNT_ID;
	const accessKeyId = c.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = c.env.R2_SECRET_ACCESS_KEY;

	console.info("R2 signed fetch environment", {
		bucketName,
		accountId,
		hasAccessKey: Boolean(accessKeyId),
		hasSecretAccessKey: Boolean(secretAccessKey),
	});

	try {
		const signedUrl = await signedVideoRepository.fetchSignedVideo({
			bucketName,
			accountId,
			objectKey: key,
			accessKeyId,
			secretAccessKey,
		});

		return c.json({ url: signedUrl });
	} catch (error) {
		if (error instanceof signedVideoRepository.SignedVideoFetchError) {
			return c.json({ error: error.message }, 500);
		}

		console.error("R2 signed video get failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return c.json({ error: message }, 500);
	}
});

app.post("/posts", async (c) => {
	const db = dbConnect(c.env);

	try {
		const reqBody =
			await c.req.json<components["schemas"]["CreatePostRequest"]>();

		if (
			typeof reqBody.shelterId !== "number" ||
			Number.isNaN(reqBody.shelterId)
		) {
			const errorResponse: components["schemas"]["ErrorResponse"] = {
				error: "shelterId must be a number",
			};
			return c.json(errorResponse, 400);
		}

		const now = new Date().toISOString();
		const maybeCrypto = (
			globalThis as unknown as { crypto?: { randomUUID?: () => string } }
		).crypto;
		const postId = maybeCrypto?.randomUUID
			? maybeCrypto.randomUUID()
			: `post-${Date.now()}`;

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
			postedAt: reqBody.postedAt ?? now,
			latitude: firstLocation ? firstLocation.latitude : 0,
			longitude: firstLocation ? firstLocation.longitude : 0,
			is_synced: 0,
			createdAtByPost: now,
			isFreeChat: 0,
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

		if (
			reqBody.media &&
			Array.isArray(reqBody.media) &&
			reqBody.media.length > 0
		) {
			const maybeCrypto = (
				globalThis as unknown as { crypto?: { randomUUID?: () => string } }
			).crypto;

			for (const mi of reqBody.media) {
				const mediaId = maybeCrypto?.randomUUID
					? maybeCrypto.randomUUID()
					: `media-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

				const filePath = `public/uploads/${mediaId}`;

				mediaItems.push({
					id: mediaId,
					file_path: filePath,
					mediaType: mi.mediaType,
					fileName: mi.fileName ?? null,
					created_at: now,
				});
			}
		}

		try {
			await shelterRepository.insertShelterPost(
				db,
				shelterPost,
				mediaItems.length > 0 ? mediaItems : undefined,
			);
		} catch (err) {
			if (err instanceof shelterRepository.ShelterNotFoundError) {
				const errorResponse: components["schemas"]["ErrorResponse"] = {
					error: "指定した避難所は存在しません",
				};
				return c.json(errorResponse, 404);
			}
			throw err;
		}

		const responsePost: components["schemas"]["CreatePostResponse"]["post"] = {
			id: shelterPost.postId,
			authorName: shelterPost.authorName,
			shelterId: shelterPost.shelterId,
			content: shelterPost.content,
			postedAt: shelterPost.postedAt,
			createdAt: shelterPost.createdAtByPost,
		} as components["schemas"]["CreatePostResponse"]["post"];

		if (reqBody.locationTrack && Array.isArray(reqBody.locationTrack)) {
			responsePost.locationTrack = reqBody.locationTrack.map((pt) => ({
				recordedAt: pt.recordedAt,
				latitude: pt.latitude,
				longitude: pt.longitude,
			}));
		}

		responsePost.media = [];
		if (mediaItems.length > 0) {
			responsePost.media = mediaItems.map((m) => ({
				mediaType: m.mediaType,
				fileName: m.fileName ?? null,
			}));
		}

		return c.json({ post: responsePost }, 201);
	} catch (error) {
		console.error("D1 insert post failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		const errorResponse: components["schemas"]["ErrorResponse"] = {
			error: message,
		};
		return c.json(errorResponse, 500);
	}
});

export default app;
