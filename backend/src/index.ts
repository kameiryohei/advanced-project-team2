import { Hono } from "hono";
import type { Bindings } from "./db/database";
import { dbConnect } from "./db/database";
import {
	countShelters,
	fetchRecentPostsByShelter,
	fetchShelterDetails,
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

export default app;
