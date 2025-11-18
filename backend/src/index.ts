import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// CORS設定
app.use('*', cors({
	origin: ['http://localhost:5173', 'http://localhost:3000'],
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization'],
}));

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
	const apiKey = c.env?.YAHOO_MAPS_API_KEY;
	if (!apiKey) {
		return c.json({ error: "APIキーが設定されていません" }, 500);
	}

	try {
		const response = await fetch(
			`https://map.yahooapis.jp/geoapi/V1/reverseGeoCoder?lat=${lat}&lon=${lon}&appid=${apiKey}&output=json`
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
	} catch (error) {
		console.error("逆ジオコーディングエラー:", error);
		return c.json({ error: "住所の取得に失敗しました" }, 500);
	}
});

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
		console.log("位置情報を受信:", { latitude, longitude });
		
		return c.json({ 
			message: "位置情報を保存しました", 
			location: { latitude, longitude } 
		});
	} catch (error) {
		console.error("位置情報保存エラー:", error);
		return c.json({ error: "位置情報の保存に失敗しました" }, 500);
	}
});

export default app;
