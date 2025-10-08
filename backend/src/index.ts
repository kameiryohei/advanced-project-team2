import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Team2!");
});

export default app;
