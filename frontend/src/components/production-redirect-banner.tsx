"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ProductionRedirectBanner() {
	const [isVisible, setIsVisible] = useState(false);
	const [productionUrl, setProductionUrl] = useState("");

	useEffect(() => {
		const checkProductionApi = async () => {
			const isLocal = import.meta.env.VITE_NODE_ENV === "local";
			const productionApiUrl = import.meta.env.VITE_PRODUCTION_API_URL;
			const productionFrontendUrl = import.meta.env
				.VITE_PRODUCTION_FRONTEND_URL;

			// ローカル環境かつ必要なURLが設定されている場合のみ実行
			if (!isLocal || !productionApiUrl || !productionFrontendUrl) {
				return;
			}

			// バナーを閉じた記録があれば表示しない
			const dismissed = sessionStorage.getItem("production-banner-dismissed");
			if (dismissed === "true") {
				return;
			}

			try {
				// 5秒のタイムアウトを設定
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 5000);

				const response = await fetch(productionApiUrl, {
					method: "GET",
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (response.ok) {
					setProductionUrl(productionFrontendUrl);
					setIsVisible(true);
				} else {
				}
			} catch (error) {
				// タイムアウトやネットワークエラーの場合は何もしない
				if (error instanceof Error && error.name === "AbortError") {
					console.log();
				} else {
					console.log("ℹ️ 本番APIに接続できません。ローカル環境で継続します。");
				}
			}
		};

		checkProductionApi();
	}, []);

	const handleRedirect = () => {
		if (productionUrl) {
			window.open(productionUrl, "_blank", "noopener,noreferrer");
		}
	};

	if (!isVisible) {
		return null;
	}

	return (
		<div className="space-y-6">
			<Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
				<Info className="text-blue-600 shrink-0" />
				<AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
					<span className="text-sm sm:text-base text-blue-900 dark:text-blue-100">
						本番環境が利用可能です。より安定したサービスをご利用いただけます。
					</span>
					<div className="flex items-center gap-2 shrink-0">
						<Button
							size="sm"
							onClick={handleRedirect}
							className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm"
						>
							<ExternalLink className="h-3 w-3 mr-1" />
							本番環境に移動
						</Button>
					</div>
				</AlertDescription>
			</Alert>
		</div>
	);
}
