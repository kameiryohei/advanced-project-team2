import { Hono } from "hono";
import type { Bindings } from "./db/database";
import { dbConnect } from "./db/database";
import { shelterRepository, videoRepository } from "./repositories";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
	console.log("Hello Team2!");
	return c.text("Hello Team2!");
});

app.get("/db-check", async (c) => {
	const db = dbConnect(c.env);

	try {
		const shelterCount = await shelterRepository.countShelters(db);
		return c.json({ shelterCount });
	} catch (error) {
		console.error("D1 query failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return c.json({ error: message }, 500);
	}
});

app.get("/shelters/:id", async (c) => {
	const shelterId = Number.parseInt(c.req.param("id"), 10);

	if (Number.isNaN(shelterId)) {
		return c.json({ error: "shelterId must be a number" }, 400);
	}

	const db = dbConnect(c.env);

	try {
		const details = await shelterRepository.fetchShelterDetails(db, shelterId);
		return c.json(details);
	} catch (error) {
		console.error("D1 posts query failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return c.json({ error: message }, 500);
	}
});

app.get("/db-getShelterList", async (c) => {
	const db = dbConnect(c.env);

	try {
		const shelterList = await shelterRepository.getShelterList(db);
		return c.json({ shelterList });
	} catch (error) {
		console.error("D1 query failed", error);

		const message = error instanceof Error ? error.message : "Unknown error";
		return c.json({ error: message }, 500);
	}
});

app.get("/shelters/:id/posts", async (c) => {
	const shelterId = Number.parseInt(c.req.param("id"), 10);

	if (Number.isNaN(shelterId)) {
		return c.json({ error: "shelterId must be a number" }, 400);
	}

	const db = dbConnect(c.env);

	try {
		const posts =
			await shelterRepository.fetchRecentPostsByShelter(db, shelterId);
		return c.json({ shelterId, posts });
	} catch (error) {
		console.error("D1 posts query failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return c.json({ error: message }, 500);
	}
});

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
