import {
	AlertTriangle,
	CheckCircle,
	Clock,
	MapPin,
	Users,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useState } from "react";
import { useGetShelters } from "@/api/generated/team2API";
import { ShelterMap } from "@/components/shelter-map";
import { SyncLogViewer } from "@/components/sync-log-viewer";
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
	const [expandedId, setExpandedId] = useState<string | null>(null);

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
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
					<h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
						<img
							src="/Shel-Thred-logo.png"
							alt="Shel-Thread Logo"
							className="w-10 h-10 rounded-full"
						/>
						Shel-Thread
						<span className="text-sm sm:text-base text-muted-foreground font-normal">
							/ 災害情報掲示板
						</span>
					</h1>
					<SyncStatus />
				</div>

				{/* Summary Cards */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

				{/* Shelters Table - Desktop View */}
				<Card className="hidden md:block">
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

				{/* Mobile Card View */}
				<div className="md:hidden space-y-4">
					<div className="flex items-center space-x-2 px-2">
						<MapPin className="h-5 w-5" />
						<h2 className="text-lg font-semibold">避難所一覧</h2>
					</div>
					<div className="space-y-3">
						{shelters.map((shelter) => (
							<Card
								key={shelter.id}
								className="cursor-pointer hover:bg-muted/50 transition-all duration-200"
								onClick={() => {
									if (expandedId === shelter.id) {
										// 既に展開されている場合は詳細画面へ遷移
										onShelterSelect(shelter.id);
									} else {
										// 詳細を展開
										setExpandedId(shelter.id);
									}
								}}
							>
								<CardContent className="p-4">
									{/* 常時表示される概要 */}
									<div className="space-y-2">
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1 min-w-0">
												<h3 className="font-semibold text-base mb-1">
													{shelter.name}
												</h3>
												<p className="text-sm text-muted-foreground truncate mb-2">
													{shelter.address}
												</p>
												<div className="flex items-center gap-2 flex-wrap">
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
													{shelter.urgentReports > 0 && (
														<Badge
															variant="destructive"
															className="bg-danger text-danger-foreground"
														>
															緊急: {shelter.urgentReports}
														</Badge>
													)}
												</div>
											</div>
											<Button
												variant="ghost"
												size="sm"
												className="shrink-0"
												onClick={(e) => {
													e.stopPropagation();
													setExpandedId(
														expandedId === shelter.id ? null : shelter.id,
													);
												}}
											>
												{expandedId === shelter.id ? "▲" : "▼"}
											</Button>
										</div>

										{/* 展開時のみ表示される詳細 */}
										{expandedId === shelter.id && (
											<div className="mt-3 pt-3 border-t space-y-2 text-sm">
												<div className="flex items-center gap-2">
													<MapPin className="h-4 w-4 text-muted-foreground" />
													<span className="text-muted-foreground">距離:</span>
													<span className="font-medium">
														{shelter.distance === "-"
															? "距離未計算"
															: shelter.distance}
													</span>
												</div>
												<div className="flex items-center gap-2">
													<Users className="h-4 w-4 text-muted-foreground" />
													<span className="text-muted-foreground">
														推定人数:
													</span>
													<span className="font-medium">
														{shelter.population}人
													</span>
												</div>
												<div className="flex items-center gap-2">
													<AlertTriangle className="h-4 w-4 text-muted-foreground" />
													<span className="text-muted-foreground">
														報告状況:
													</span>
													<div className="flex gap-2">
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
												</div>
												<div className="flex items-center gap-2">
													<Clock className="h-4 w-4 text-muted-foreground" />
													<span className="text-muted-foreground">
														最終更新:
													</span>
													<span className="font-medium text-xs">
														{shelter.lastUpdate}
													</span>
												</div>
												<Button
													variant="outline"
													size="sm"
													className="w-full mt-2"
													onClick={(e) => {
														e.stopPropagation();
														onShelterSelect(shelter.id);
													}}
												>
													詳細を確認
												</Button>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
				{/* Sync Logs */}
				<Card>
					<CardHeader>
						<CardTitle>同期ログ（全避難所）</CardTitle>
					</CardHeader>
					<CardContent>
						<SyncLogViewer />
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
