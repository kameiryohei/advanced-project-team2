import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { useGetSheltersId } from "@/api/generated/team2API";
import { ShelterDashboard } from "@/components/shelter-dashboard";
import { ShelterOverview } from "@/components/shelter-overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	checkProductionApiAndRedirect,
	getInitialShelterId,
} from "@/lib/environment-utils";

export default function HomePage() {
	const [selectedShelter, setSelectedShelter] = useState<string | null>(
		getInitialShelterId,
	);

	// 初回マウント時に本番APIの疎通確認を実行
	useEffect(() => {
		checkProductionApiAndRedirect();
	}, []);

	// 選択された避難所の存在確認
	const {
		data: shelterData,
		isLoading,
		error,
	} = useGetSheltersId(Number.parseInt(selectedShelter || "0", 10), {
		query: {
			enabled: !!selectedShelter, // selectedShelterがある場合のみ実行
		},
	});

	// 避難所詳細画面を表示中の場合
	if (selectedShelter) {
		// ローディング中
		if (isLoading) {
			return (
				<main className="min-h-screen bg-background flex items-center justify-center">
					<div className="text-center space-y-4">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
						<p className="text-muted-foreground">避難所情報を読み込み中...</p>
					</div>
				</main>
			);
		}

		// エラーまたは避難所が存在しない場合
		if (error || !shelterData) {
			return (
				<main className="min-h-screen bg-background flex items-center justify-center p-6">
					<Card className="max-w-md w-full">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-destructive">
								<AlertTriangle className="h-6 w-6" />
								避難所が見つかりません
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-muted-foreground">
								指定された避難所（ID: {selectedShelter}
								）は存在しないか、現在利用できません。
							</p>
							<div className="space-y-2">
								<Button
									onClick={() => setSelectedShelter(null)}
									className="w-full"
								>
									<Home className="h-4 w-4 mr-2" />
									避難所一覧に戻る
								</Button>
							</div>
						</CardContent>
					</Card>
				</main>
			);
		}

		// 正常に避難所が取得できた場合、詳細画面を表示
		const isLocal = import.meta.env.VITE_NODE_ENV === "local";

		return (
			<main className="min-h-screen bg-background">
				{!isLocal && (
					<div className="p-4 border-b bg-card">
						<Button
							variant="ghost"
							onClick={() => setSelectedShelter(null)}
							className="flex items-center space-x-2"
						>
							<ArrowLeft className="h-4 w-4" />
							<span>避難所一覧に戻る</span>
						</Button>
					</div>
				)}
				<ShelterDashboard shelterId={selectedShelter} />
			</main>
		);
	}

	// 避難所一覧画面を表示
	return (
		<main className="min-h-screen bg-background">
			<ShelterOverview onShelterSelect={setSelectedShelter} />
		</main>
	);
}
