import {
	AlertTriangle,
	CheckCircle,
	MapPin,
	Users,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useGetShelters } from "@/api/generated/team2API";
import { ShelterMap } from "@/components/shelter-map";
import { SyncStatus } from "@/components/sync-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Shelter {
	id: string;
	name: string;
	distance: string;
	status: "online" | "offline";
	population: number;
	activeReports: number;
	urgentReports: number;
	lastUpdate: string;
	address: string;
	latitude: number;
	longitude: number;
}

interface ShelterOverviewProps {
	onShelterSelect: (shelterId: string) => void;
}

export function ShelterOverview({ onShelterSelect }: ShelterOverviewProps) {
	// APIから避難所一覧を取得
	const { data: sheltersData, isLoading, error } = useGetShelters();

	// APIデータをローカル型にマッピング
	const shelters: Shelter[] = (sheltersData?.shelterList ?? []).map((s) => ({
		id: String(s.id),
		name: s.name,
		address: s.address ?? "住所未登録",
		latitude: s.latitude ?? 35.17, // デフォルト座標（名古屋市）
		longitude: s.longitude ?? 136.9,
		// 以下はモックデータ（APIから取得できない情報）
		distance: "-",
		status: "online" as const,
		population: Math.floor(Math.random() * 50) + 10, // モック
		activeReports: Math.floor(Math.random() * 10), // モック
		urgentReports: Math.floor(Math.random() * 3), // モック
		lastUpdate: new Date().toLocaleString("ja-JP"),
	}));

	const totalShelters = shelters.length;
	const onlineShelters = shelters.filter((s) => s.status === "online").length;
	const totalPopulation = shelters.reduce((sum, s) => sum + s.population, 0);
	const totalUrgentReports = shelters.reduce(
		(sum, s) => sum + s.urgentReports,
		0,
	);

	// ローディング状態
	if (isLoading) {
		return (
			<div className="min-h-screen bg-background p-6 flex items-center justify-center">
				<div className="text-center space-y-4">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
					<p className="text-muted-foreground">避難所データを読み込み中...</p>
				</div>
			</div>
		);
	}

	// エラー状態
	if (error) {
		return (
			<div className="min-h-screen bg-background p-6 flex items-center justify-center">
				<div className="text-center space-y-4">
					<AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
					<p className="text-destructive">避難所データの取得に失敗しました</p>
					<p className="text-sm text-muted-foreground">
						ネットワーク接続を確認してください
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="text-center space-y-2">
						<h1 className="text-3xl font-bold text-foreground">災害対策本部</h1>
						<p className="text-muted-foreground">
							避難所管理システム - 中央集約サーバー
						</p>
					</div>
					<SyncStatus />
				</div>

				{/* Summary Cards */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center space-x-2">
								<MapPin className="h-5 w-5 text-primary" />
								<div>
									<p className="text-sm text-muted-foreground">総避難所数</p>
									<p className="text-2xl font-bold">{totalShelters}</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-4">
							<div className="flex items-center space-x-2">
								<Wifi className="h-5 w-5 text-success" />
								<div>
									<p className="text-sm text-muted-foreground">オンライン</p>
									<p className="text-2xl font-bold text-success">
										{onlineShelters}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-4">
							<div className="flex items-center space-x-2">
								<Users className="h-5 w-5 text-info" />
								<div>
									<p className="text-sm text-muted-foreground">総避難者数</p>
									<p className="text-2xl font-bold text-info">
										{totalPopulation}人
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-4">
							<div className="flex items-center space-x-2">
								<AlertTriangle className="h-5 w-5 text-danger" />
								<div>
									<p className="text-sm text-muted-foreground">緊急報告</p>
									<p className="text-2xl font-bold text-danger">
										{totalUrgentReports}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Map Section - 新規追加 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center space-x-2">
							<MapPin className="h-5 w-5" />
							<span>避難所マップ</span>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ShelterMap shelters={shelters} onShelterSelect={onShelterSelect} />
						<div className="mt-4 flex items-center space-x-4 text-sm text-gray-600">
							<div className="flex items-center space-x-2">
								<div className="w-3 h-3 bg-green-500 rounded-full"></div>
								<span>オンライン</span>
							</div>
							<div className="flex items-center space-x-2">
								<div className="w-3 h-3 bg-red-500 rounded-full"></div>
								<span>オフライン</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Shelters Table */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center space-x-2">
							<MapPin className="h-5 w-5" />
							<span>避難所一覧</span>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr className="border-b">
										<th className="text-left p-3 font-medium">避難所名</th>
										<th className="text-left p-3 font-medium">住所</th>
										<th className="text-left p-3 font-medium">
											避難所までの距離
										</th>
										<th className="text-left p-3 font-medium">
											オンライン/オフライン
										</th>
										<th className="text-left p-3 font-medium">推定人数</th>
										<th className="text-left p-3 font-medium">報告状況</th>
										<th className="text-left p-3 font-medium">最終更新</th>
										<th className="text-left p-3 font-medium">操作</th>
									</tr>
								</thead>
								<tbody>
									{shelters.map((shelter) => (
										<tr
											key={shelter.id}
											className="border-b hover:bg-muted/50 cursor-pointer"
											onClick={() => onShelterSelect(shelter.id)}
										>
											<td className="p-3 font-medium">{shelter.name}</td>
											<td className="p-3 text-sm text-gray-600">
												{shelter.address}
											</td>
											<td className="p-3">{shelter.distance}</td>
											<td className="p-3">
												<Badge
													variant={
														shelter.status === "online"
															? "default"
															: "destructive"
													}
													className={
														shelter.status === "online"
															? "bg-success text-success-foreground"
															: "bg-danger text-danger-foreground"
													}
												>
													{shelter.status === "online" ? (
														<>
															<Wifi className="h-3 w-3 mr-1" />
															オンライン
														</>
													) : (
														<>
															<WifiOff className="h-3 w-3 mr-1" />
															オフライン
														</>
													)}
												</Badge>
											</td>
											<td className="p-3">{shelter.population}人</td>
											<td className="p-3">
												<div className="flex space-x-2">
													<Badge variant="outline" className="text-xs">
														報告: {shelter.activeReports}
													</Badge>
													{shelter.urgentReports > 0 && (
														<Badge
															variant="destructive"
															className="text-xs bg-danger text-danger-foreground"
														>
															緊急: {shelter.urgentReports}
														</Badge>
													)}
												</div>
											</td>
											<td className="p-3 text-sm text-muted-foreground">
												{shelter.lastUpdate}
											</td>
											<td className="p-3">
												<Button
													size="sm"
													onClick={(e) => {
														e.stopPropagation();
														onShelterSelect(shelter.id);
													}}
												>
													詳細表示
												</Button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>

				{/* Quick Actions */}
				<div className="flex flex-wrap gap-4 justify-center">
					<Button
						variant="outline"
						className="flex items-center space-x-2 bg-transparent"
					>
						<CheckCircle className="h-4 w-4" />
						<span>全避難所同期</span>
					</Button>
					<Button
						variant="outline"
						className="flex items-center space-x-2 bg-transparent"
					>
						<AlertTriangle className="h-4 w-4" />
						<span>緊急報告一覧</span>
					</Button>
					<Button
						variant="outline"
						className="flex items-center space-x-2 bg-transparent"
					>
						<Users className="h-4 w-4" />
						<span>避難者統計</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
