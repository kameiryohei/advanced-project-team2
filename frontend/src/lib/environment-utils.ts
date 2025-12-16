/**
 * 本番APIの疎通確認とリダイレクト処理
 */
export const checkProductionApiAndRedirect = async () => {
	const isLocal = import.meta.env.VITE_NODE_ENV === "local";
	const productionApiUrl = import.meta.env.VITE_PRODUCTION_API_URL;
	const productionFrontendUrl = import.meta.env.VITE_PRODUCTION_FRONTEND_URL;

	// ローカル環境かつ必要なURLが設定されている場合のみ実行
	if (!isLocal || !productionApiUrl || !productionFrontendUrl) {
		return;
	}

	try {
		console.log("🔍 本番APIの疎通確認中:", productionApiUrl);

		// 5秒のタイムアウトを設定
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		const response = await fetch(productionApiUrl, {
			method: "GET",
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (response.ok) {
			console.log(
				"✅ 本番APIが稼働中です。本番フロントエンドにリダイレクトします:",
				productionFrontendUrl,
			);
			window.location.href = productionFrontendUrl;
		} else {
			console.log("ℹ️ 本番APIは利用できません。ローカル環境で継続します。");
		}
	} catch (error) {
		// タイムアウトやネットワークエラーの場合は何もしない
		if (error instanceof Error && error.name === "AbortError") {
			console.log(
				"⏱️ 本番APIの応答がタイムアウトしました。ローカル環境で継続します。",
			);
		} else {
			console.log("ℹ️ 本番APIに接続できません。ローカル環境で継続します。");
		}
	}
};

/**
 * 環境変数から初期表示する避難所IDを取得
 */
export const getInitialShelterId = (): string | null => {
	const isLocal = import.meta.env.VITE_NODE_ENV === "local";
	const defaultShelterId = import.meta.env.VITE_DEFAULT_SHELTER_ID;

	if (isLocal && defaultShelterId) {
		console.log(
			"🏠 ローカル環境: 避難所詳細画面を初期表示します (ID:",
			defaultShelterId,
			")",
		);
		return defaultShelterId;
	}

	console.log("🌐 本番環境: 避難所一覧画面を初期表示します");
	return null;
};
