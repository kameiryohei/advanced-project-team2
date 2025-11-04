import { Hono } from "hono";
import type { Bindings } from "./db/database";
import { dbConnect } from "./db/database";
import {
	countShelters,
	fetchRecentPostsByShelter,
	fetchShelterDetails,
	getShelterList,
} from "./repositories/shelterRepository";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
	console.log("Hello Team2!");
	return c.text("Hello Team2!");
});

app.get("/db-check", async (c) => {
	const db = dbConnect(c.env);

	try {
		const shelterCount = await countShelters(db);
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
		const details = await fetchShelterDetails(db, shelterId);
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
		const shelterList = await getShelterList(db);
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
		const posts = await fetchRecentPostsByShelter(db, shelterId);
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

		if (body.byteLength === 0) {
			return c.json({ error: "Request body is empty" }, 400);
		}

		await bucket.put(key, body, {
			httpMetadata: { contentType },
		});

		return c.json({ key, storedBytes: body.byteLength, contentType });
	} catch (error) {
		console.error("R2 video put failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return c.json({ error: message }, 500);
	}
});

app.get("/r2/test-video/:key", async (c) => {
	const key = c.req.param("key");
	const bucket = c.env.ASSET_BUCKET;

	try {
		const object = await bucket.get(key);
		if (!object) {
			return c.json({ error: `Object not found for key ${key}` }, 404);
		}

		const body = await object.arrayBuffer();
		const headers = new Headers();

		object.writeHttpMetadata(headers);
		headers.set(
			"Content-Type",
			object.httpMetadata?.contentType ?? "application/octet-stream",
		);
		headers.set("Content-Length", object.size.toString());

		return c.newResponse(body, { headers });
	} catch (error) {
		console.error("R2 video get failed", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return c.json({ error: message }, 500);
	}
});

export default app;
