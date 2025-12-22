"use client";

import {
	AlertTriangle,
	Clock,
	FileText,
	MapPin,
	MessageSquare,
	User,
	Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	useGetPostsId,
	useGetShelters,
	useGetSheltersId,
	useGetSheltersIdPosts,
} from "@/api/generated/team2API";
import { ConversationThread } from "@/components/conversation-thread";
import { ReportForm } from "@/components/report-form";
import { ReportMap } from "@/components/report-map";
import { SyncLogViewer } from "@/components/sync-log-viewer";
import { SyncStatus } from "@/components/sync-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { syncService } from "@/lib/sync-service";

interface Report {
	id: string;
	datetime: string;
	address: string;
	details: string;
	status: "緊急" | "重要" | "通常" | null;
	reporter: string;
	attachment?: string;
	responder?: string;
	latitude?: number;
	longitude?: number;
}

interface Message {
	id: string;
	time: string;
	responder: string;
	message: string;
	status: string;
	isResponder: boolean;
}

interface ShelterDashboardProps {
	shelterId?: string;
}

const getStatusColor = (status: string | null | undefined) => {
	switch (status) {
		case "緊急":
			return "bg-red-600 text-white"; // 赤色（緊急）
		case "重要":
			return "bg-amber-400 text-slate-900"; // オレンジ色（重要）
		case "通常":
			return "bg-emerald-600 text-white"; // 緑色（通常）
		default:
			return "bg-muted text-muted-foreground";
	}
};

export function ShelterDashboard({ shelterId }: ShelterDashboardProps) {
	const [isOnline, setIsOnline] = useState(navigator.onLine);
	const [selectedReport, setSelectedReport] = useState<string | null>(null);
	const [showReportForm, setShowReportForm] = useState(false);
	const [reports, setReports] = useState<Report[]>([]);
	const [messages, setMessages] = useState<{ [key: string]: Message[] }>({});
	const [expandedId, setExpandedId] = useState<string | null>(null);

	// APIクライアントの初期化
	const currentShelterId = Number.parseInt(shelterId || "1", 10);
	const { data: sheltersData } = useGetShelters();
	const { data: shelterDetails } = useGetSheltersId(currentShelterId);
	const { data: shelterPosts } = useGetSheltersIdPosts(currentShelterId);

	// 現在の避難所IDをローカルストレージに保存（自動同期で使用）
	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	// 現在の避難所IDをローカルストレージに保存（自動同期で使用）
	useEffect(() => {
		syncService.saveToLocal("current_shelter_id", currentShelterId);
		console.log("現在の避難所ID保存:", currentShelterId);

		return () => {
			// コンポーネントがアンマウントされたら避難所IDをクリア
			syncService.saveToLocal("current_shelter_id", null);
		};
	}, [currentShelterId]);

	// 選択された投稿の詳細を取得
	const { data: selectedPostDetail, isLoading: isLoadingPostDetail } =
		useGetPostsId(selectedReport || "", {
			query: {
				enabled: !!selectedReport, // selectedReportがある場合のみ実行
			},
		});

	// APIデータのログ出力と状態更新
	useEffect(() => {
		if (sheltersData) {
			console.log("避難所一覧データ:", sheltersData);
		}
		if (shelterDetails) {
			console.log("避難所詳細データ:", shelterDetails);
		}
		if (shelterPosts) {
			console.log("避難所投稿データ:", shelterPosts);
			// APIから取得した投稿データを現在の報告リストに変換
			const convertedReports: Report[] = shelterPosts.posts.map((post) => ({
				id: post.id,
				datetime: new Date(post.posted_at)
					.toLocaleString("ja-JP", {
						year: "numeric",
						month: "2-digit",
						day: "2-digit",
						hour: "2-digit",
						minute: "2-digit",
					})
					.replace(/\//g, "/")
					.replace(",", ""),
				address: post.address || `避難所 ${currentShelterId}`,
				details: post.content || "投稿内容なし",
				status: post.status || null,
				reporter: post.author_name,
				responder: post.status || "-",
			}));
			setReports(convertedReports);
		}
	}, [sheltersData, shelterDetails, shelterPosts, currentShelterId]);

	useEffect(() => {
		// ローカルストレージからメッセージのみ読み込み（reportsはAPIから取得するため除外）
		const storedMessages = syncService.loadFromLocal(`messages_${shelterId}`);

		if (storedMessages && typeof storedMessages === "object") {
			setMessages(storedMessages as { [key: string]: Message[] });
		}

		syncService.onSyncComplete((syncData) => {
			if (syncData.messages && typeof syncData.messages === "object") {
				setMessages(syncData.messages as { [key: string]: Message[] });
			}
		});
	}, [shelterId]);

	useEffect(() => {
		syncService.saveToLocal(`messages_${shelterId}`, messages);
	}, [messages, shelterId]);

	const handleNewReport = (newReport: Report) => {
		setReports((prev) => [newReport, ...prev]);
	};

	const handleUpdateReportStatus = (
		reportId: string,
		status: Report["status"],
	) => {
		setReports((prev) =>
			prev.map((report) =>
				report.id === reportId ? { ...report, status } : report,
			),
		);
	};

	const selectedReportData = reports.find((r) => r.id === selectedReport);
	const shelterName = shelterDetails?.name || "避難所管理システム";
	const shelterAddress = shelterDetails?.address || "住所未登録";
	const shelterLatitude = shelterDetails?.latitude;
	const shelterLongitude = shelterDetails?.longitude;

	return (
		<div className="container mx-auto p-4 space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div className="flex items-center gap-4">
					<AlertTriangle className="h-8 w-8 text-primary" />
					<div>
						<h1 className="text-2xl sm:text-3xl font-bold text-foreground">
							{shelterName}
						</h1>
						<p className="text-sm sm:text-base text-muted-foreground flex items-center gap-2">
							<MapPin className="h-4 w-4" />
							{shelterAddress}
						</p>
						{shelterLatitude && shelterLongitude && (
							<p className="text-xs text-muted-foreground mt-1">
								座標: {shelterLatitude}, {shelterLongitude}
							</p>
						)}
					</div>
				</div>
				<SyncStatus />
			</div>

			{/* Status Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">重要報告</CardTitle>
						<AlertTriangle className="h-4 w-4 text-destructive" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-destructive">
							{reports.filter((r) => r.status === "重要").length}件
						</div>
						<p className="text-xs text-muted-foreground">
							重要ステータスの報告数
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							{shelterPosts ? "投稿数" : "緊急報告"}
						</CardTitle>
						<AlertTriangle className="h-4 w-4 text-destructive" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-destructive">
							{shelterPosts
								? shelterPosts.posts.length
								: reports.filter((r) => r.status === "緊急").length}
							件
						</div>
						<p className="text-xs text-muted-foreground">
							{shelterPosts ? "API取得済み投稿" : "緊急対応が必要"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							オンライン / オフライン状態
						</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{isOnline ? "オンライン" : "オフライン"}
						</div>
						<p className="text-xs text-muted-foreground">現在の接続状態</p>
					</CardContent>
				</Card>
			</div>

			{/* Main Content */}
			<Tabs defaultValue="reports" className="space-y-4">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="reports" className="flex items-center gap-2">
						<FileText className="h-4 w-4" />
						報告管理
					</TabsTrigger>
					<TabsTrigger value="chat" className="flex items-center gap-2">
						<MessageSquare className="h-4 w-4" />
						フリーチャット
					</TabsTrigger>
					<TabsTrigger value="sync-logs" className="flex items-center gap-2">
						<Clock className="h-4 w-4" />
						同期ログ
					</TabsTrigger>
				</TabsList>

				<TabsContent value="reports" className="space-y-4">
					<div className="flex items-center justify-between">
						<h2 className="text-xl font-semibold">災害報告一覧</h2>
						<Button
							className="bg-primary text-primary-foreground hover:bg-primary/90"
							onClick={() => setShowReportForm(true)}
						>
							新規報告作成
						</Button>
					</div>

					{selectedReport && selectedReportData ? (
						<ConversationThread
							report={selectedReportData}
							messages={messages[selectedReport] || []}
							onBack={() => setSelectedReport(null)}
							onUpdateReportStatus={handleUpdateReportStatus}
							postDetail={selectedPostDetail}
							isLoadingPostDetail={isLoadingPostDetail}
						/>
					) : (
						<>
							{/* Desktop Table View */}
							<Card className="hidden md:block">
								<CardContent className="p-0">
									<div className="overflow-x-auto">
										<table className="w-full">
											<thead className="bg-muted">
												<tr>
													<th className="text-left p-4 font-medium">日時</th>
													<th className="text-left p-4 font-medium">住所</th>
													<th className="text-left p-4 font-medium">詳細</th>
													<th className="text-left p-4 font-medium">
														ステータス
													</th>
													<th className="text-left p-4 font-medium">報告者</th>
													<th className="text-left p-4 font-medium">添付</th>
													<th className="text-left p-4 font-medium">対応者</th>
												</tr>
											</thead>
											<tbody>
												{reports.length === 0 ? (
													<tr>
														<td
															colSpan={7}
															className="p-8 text-center text-muted-foreground"
														>
															報告データがありません
														</td>
													</tr>
												) : (
													reports.map((report) => (
														<tr
															key={report.id}
															className="border-b hover:bg-muted/50 cursor-pointer"
															onClick={() => setSelectedReport(report.id)}
														>
															<td className="p-4">{report.datetime}</td>
															<td className="p-4">{report.address}</td>
															<td className="p-4">{report.details}</td>
															<td className="p-4">
																<Badge
																	className={getStatusColor(report.status)}
																>
																	{report.status || "-"}
																</Badge>
															</td>
															<td className="p-4">{report.reporter}</td>
															<td className="p-4">
																{report.attachment || "-"}
															</td>
															<td className="p-4">{report.responder}</td>
														</tr>
													))
												)}
											</tbody>
										</table>
									</div>
								</CardContent>
							</Card>

							{/* Mobile Card View */}
							<div className="md:hidden space-y-3">
								{reports.length === 0 ? (
									<Card>
										<CardContent className="p-8 text-center text-muted-foreground">
											報告データがありません
										</CardContent>
									</Card>
								) : (
									reports.map((report) => (
										<Card
											key={report.id}
											className="cursor-pointer hover:bg-muted/50 transition-all duration-200"
											onClick={() => {
												if (expandedId === report.id) {
													// 既に展開されている場合は全画面表示
													setSelectedReport(report.id);
												} else {
													// 詳細を展開
													setExpandedId(report.id);
												}
											}}
										>
											<CardContent className="p-4">
												{/* 常時表示される概要 */}
												<div className="space-y-2">
													<div className="flex items-start justify-between gap-2">
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2 flex-wrap">
																<Badge
																	className={getStatusColor(report.status)}
																>
																	{report.status || "-"}
																</Badge>
																<span className="text-xs text-muted-foreground">
																	{report.datetime}
																</span>
															</div>
															<p className="text-sm font-medium mt-1 truncate">
																{report.address}
															</p>
															<p className="text-sm text-muted-foreground line-clamp-2">
																{report.details}
															</p>
														</div>
														<Button
															variant="ghost"
															size="sm"
															className="shrink-0"
															onClick={(e) => {
																e.stopPropagation();
																setExpandedId(
																	expandedId === report.id ? null : report.id,
																);
															}}
														>
															{expandedId === report.id ? "▲" : "▼"}
														</Button>
													</div>

													{/* 展開時のみ表示される詳細 */}
													{expandedId === report.id && (
														<div className="mt-3 pt-3 border-t space-y-2 text-sm">
															<div className="flex items-center gap-2">
																<User className="h-4 w-4 text-muted-foreground" />
																<span className="text-muted-foreground">
																	報告者:
																</span>
																<span className="font-medium">
																	{report.reporter}
																</span>
															</div>
															{report.attachment && (
																<div className="flex items-center gap-2">
																	<Video className="h-4 w-4 text-muted-foreground" />
																	<span className="text-muted-foreground">
																		添付:
																	</span>
																	<span className="font-medium">
																		{report.attachment}
																	</span>
																</div>
															)}
															<div className="flex items-center gap-2">
																<User className="h-4 w-4 text-muted-foreground" />
																<span className="text-muted-foreground">
																	対応者:
																</span>
																<span className="font-medium">
																	{report.responder || "-"}
																</span>
															</div>
															<Button
																variant="outline"
																size="sm"
																className="w-full mt-2"
																onClick={(e) => {
																	e.stopPropagation();
																	setSelectedReport(report.id);
																}}
															>
																詳細を確認
															</Button>
														</div>
													)}
												</div>
											</CardContent>
										</Card>
									))
								)}
							</div>
						</>
					)}
					{/* Report Map - ここに追加 */}
					{!selectedReport && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center space-x-2">
									<MapPin className="h-5 w-5" />
									<span>報告場所マップ</span>
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ReportMap
									reports={reports}
									onReportSelect={setSelectedReport}
								/>
								<div className="mt-4 flex items-center space-x-4 text-sm text-muted-foreground">
									<div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#ef4444" }}
										></div>
										<span>緊急</span>
									</div>
									<div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#f59e0b" }}
										></div>
										<span>重要</span>
									</div>
									<div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#10b981" }}
										></div>
										<span>通常</span>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="chat" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>避難所内フリーチャット</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="h-64 border rounded-lg p-4 bg-muted/20">
									<p className="text-muted-foreground text-center">
										チャット機能は次のフェーズで実装予定
									</p>
								</div>
								<div className="flex gap-2">
									<input
										type="text"
										placeholder="メッセージを入力..."
										className="flex-1 px-3 py-2 border rounded-lg bg-input"
										disabled
									/>
									<Button disabled>送信</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					{!selectedReport && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center space-x-2">
									<MapPin className="h-5 w-5" />
									<span>報告場所マップ</span>
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ReportMap
									reports={reports}
									onReportSelect={setSelectedReport}
								/>
								<div className="mt-4 flex items-center space-x-4 text-sm text-muted-foreground">
									<div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#ef4444" }}
										></div>
										<span>緊急</span>
									</div>
									<div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#f59e0b" }}
										></div>
										<span>重要</span>
									</div>
									<div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#10b981" }}
										></div>
										<span>通常</span>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="sync-logs" className="space-y-4">
					<SyncLogViewer shelterId={currentShelterId} />
				</TabsContent>
			</Tabs>

			{/* Report Form Modal */}
			{showReportForm && (
				<ReportForm
					shelterId={currentShelterId}
					onClose={() => setShowReportForm(false)}
					onSubmit={handleNewReport}
				/>
			)}
		</div>
	);
}
