import { Hono } from "hono";
import { cors } from "hono/cors";

// 環境変数の型定義
type Bindings = {
	YAHOO_MAPS_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定
app.use(
	"*",
	cors({
		origin: ["http://localhost:5173", "http://localhost:3000"],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	}),
);

app.get("/", (c) => {
	return c.text("Hello Team2!");
});

// 逆ジオコーディングエンドポイント
app.get("/api/geocode/reverse", async (c) => {
	const lat = c.req.query("lat");
	const lon = c.req.query("lon");

	if (!lat || !lon) {
		return c.json({ error: "緯度と経度が必要です" }, 400);
	}

	// 環境変数からAPIキーを取得
	const apiKey = c.env.YAHOO_MAPS_API_KEY;
	if (!apiKey) {
		return c.json({ error: "APIキーが設定されていません" }, 500);
	}

	try {
		const response = await fetch(
			`https://map.yahooapis.jp/geoapi/V1/reverseGeoCoder?lat=${lat}&lon=${lon}&appid=${apiKey}&output=json`,
		);

		if (!response.ok) {
			throw new Error("Yahoo APIからのレスポンスが失敗しました");
		}

		const data = await response.json();

		if (data.Feature && data.Feature.length > 0) {
			const address = data.Feature[0].Property.Address;
			return c.json({ address });
		}

		return c.json({ error: "住所が見つかりませんでした" }, 404);
	} catch {
		// console.error("逆ジオコーディングエラー:");
		return c.json({ error: "住所の取得に失敗しました" }, 500);
	}
});

// 日本時間（JST）でタイムスタンプを取得する関数
function getJSTTimestamp(): string {
	const now = new Date();
	const jstDate = new Date(
		now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }),
	);
	return jstDate.toLocaleString("ja-JP", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

// 位置情報保存エンドポイント
app.post("/api/location", async (c) => {
	try {
		const body = await c.req.json();
		const { latitude, longitude } = body;

		if (!latitude || !longitude) {
			return c.json({ error: "緯度と経度が必要です" }, 400);
		}

		// ここで位置情報をデータベースに保存する処理を実装
		// 現在は簡単なレスポンスを返す
		// ログ出力（Cloudflare Workers対応）
		// console.log(`[${getJSTTimestamp()}] 位置情報を受信:`, { latitude, longitude });

		return c.json({
			message: "位置情報を保存しました",
			location: { latitude, longitude },
			timestamp: getJSTTimestamp(),
		});
	} catch {
		// console.error(`[${getJSTTimestamp()}] 位置情報保存エラー:`);
		return c.json({ error: "位置情報の保存に失敗しました" }, 500);
	}
});

// 報告データ保存エンドポイント
app.post("/api/reports", async (c) => {
	try {
		const body = await c.req.json();
		const { title, description, category, location } = body;

		// 報告データにタイムスタンプを追加
		const reportData = {
			id: Date.now().toString(),
			title,
			description,
			category,
			location,
			createdAt: getJSTTimestamp(),
			status: "新規",
		};

		// console.log(`[${getJSTTimestamp()}] 報告データを受信:`, reportData);

		return c.json({
			message: "報告が保存されました",
			report: reportData,
		});
	} catch {
		// console.error(`[${getJSTTimestamp()}] 報告保存エラー:`);
		return c.json({ error: "報告の保存に失敗しました" }, 500);
	}
});

export default app;
