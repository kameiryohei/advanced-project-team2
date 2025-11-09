import { Hono } from "hono";
import type { components, paths } from "../schema/schema";
import { createMiddleware } from "../middleware/middleware";
import type { Bindings } from "./db/database";
import { dbConnect } from "./db/database";
import { shelterRepository, videoRepository } from "./repositories";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", (c, next) => {
	const frontendOrigin = c.env.FRONTEND_ORIGIN;
	const middleware = createMiddleware({
		additionalOrigins: frontendOrigin ? [frontendOrigin] : [],
	});
	return middleware(c, next);
});

app.get("/", (c) => {
	console.log("Hello Team2!");
	return c.text("Hello Team2!");
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

app.get("/r2/test-video/:key", async (c) => {
	const key = c.req.param("key");
	const bucket = c.env.ASSET_BUCKET;

	try {
		const { body, headers } = await videoRepository.getVideo({ bucket, key });
		return c.newResponse(body, { headers });
	} catch (error) {
		if (error instanceof videoRepository.VideoNotFoundError) {
			return c.json({ error: error.message }, 404);
		}

		console.error("R2 video get failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return c.json({ error: message }, 500);
	}
});

export default app;
