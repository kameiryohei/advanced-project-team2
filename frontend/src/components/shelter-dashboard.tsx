"use client";

import {
	AlertTriangle,
	Clock,
	FileText,
	MapPin,
	MessageSquare,
	Users,
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
	status: "unassigned" | "in-progress" | "resolved";
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

const mockReports: Report[] = [
	{
		id: "1",
		datetime: "2025/11/18 15:21",
		address: "愛知県塩釜口501番地",
		details: "家が崩れてます",
		status: "in-progress",
		reporter: "山田",
		attachment: "画像ファイル",
		responder: "未対応",
		latitude: 35.1355712,
		longitude: 136.9748375,
	},
	{
		id: "2",
		datetime: "2025/11/18 16:45",
		address: "愛知県名古屋市中区",
		details: "道路に倒木があり通行不可",
		status: "unassigned",
		reporter: "佐藤",
		responder: "未対応",
		latitude: 35.1629441,
		longitude: 136.910207,
	},
];

const mockMessages: { [key: string]: Message[] } = {
	"1": [
		{
			id: "1",
			time: "2025/11/18 15:30",
			responder: "警察",
			message: "道はなにで塞がれてますか？",
			status: "対応中",
			isResponder: true,
		},
		{
			id: "2",
			time: "2025/11/18 16:00",
			responder: "山田",
			message: "大きな石で塞がれてます",
			status: "対応中",
			isResponder: false,
		},
		{
			id: "3",
			time: "2025/11/18 16:30",
			responder: "警察",
			message: "1日後に対応予定",
			status: "対応中",
			isResponder: true,
		},
		{
			id: "4",
			time: "2025/11/18 17:00",
			responder: "警察",
			message: "応急処置してます。後日全ての石を撤去予定",
			status: "解決済み",
			isResponder: true,
		},
	],
};

const shelterData = {
	"1": { name: "避難所1", population: 5, location: "愛知県塩釜口" },
	"2": { name: "避難所2", population: 10, location: "愛知県名古屋市中区" },
	"3": { name: "避難所3", population: 10, location: "愛知県豊田市" },
};

const getStatusColor = (status: string) => {
	switch (status) {
		case "unassigned":
			return "bg-destructive text-destructive-foreground"; // 赤色（未対応）
		case "in-progress":
			return "bg-secondary text-secondary-foreground"; // オレンジ色（対応中）
		case "resolved":
			return "bg-chart-1 text-foreground"; // 緑色（解決済み）
		default:
			return "bg-muted text-muted-foreground";
	}
};

export function ShelterDashboard({ shelterId }: ShelterDashboardProps) {
	const [selectedReport, setSelectedReport] = useState<string | null>(null);
	const [showReportForm, setShowReportForm] = useState(false);
	const [reports, setReports] = useState<Report[]>(mockReports);
	const [messages, setMessages] = useState<{ [key: string]: Message[] }>(
		mockMessages,
	);

	// APIクライアントの初期化
	const currentShelterId = Number.parseInt(shelterId || "1", 10);
	const { data: sheltersData } = useGetShelters();
	const { data: shelterDetails } = useGetSheltersId(currentShelterId);
	const { data: shelterPosts } = useGetSheltersIdPosts(currentShelterId);

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
			const convertedReports: Report[] = shelterPosts.posts.map(
				(post, index) => ({
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
					address: post.shelter_name || `避難所 ${currentShelterId}`,
					details: post.content || "投稿内容なし",
					status:
						index % 3 === 0
							? "unassigned"
							: index % 3 === 1
								? "in-progress"
								: "resolved",
					reporter: post.author_name,
					responder: "未対応",
				}),
			);
			setReports([...mockReports, ...convertedReports]);
		}
	}, [sheltersData, shelterDetails, shelterPosts, currentShelterId]);

	useEffect(() => {
		const storedReports = syncService.loadFromLocal(`reports_${shelterId}`);
		const storedMessages = syncService.loadFromLocal(`messages_${shelterId}`);

		if (storedReports) {
			setReports(storedReports);
		}
		if (storedMessages) {
			setMessages(storedMessages);
		}

		syncService.onSyncComplete((syncData) => {
			if (syncData.reports) {
				setReports(syncData.reports);
			}
			if (syncData.messages) {
				setMessages(syncData.messages);
			}
		});
	}, [shelterId]);

	useEffect(() => {
		syncService.saveToLocal(`reports_${shelterId}`, reports);
		syncService.saveToLocal(`messages_${shelterId}`, messages);
	}, [reports, messages, shelterId]);

	const handleNewReport = (newReport: Report) => {
		setReports((prev) => [newReport, ...prev]);

		const syncStatus = syncService.getSyncStatus();
		if (!syncStatus.isOnline) {
			syncService.addPendingOperation({
				type: "create_report",
				data: newReport,
				shelterId: shelterId,
			});
		}
	};

	const handleAddMessage = (
		reportId: string,
		messageData: Omit<Message, "id">,
	) => {
		const newMessage = {
			...messageData,
			id: Date.now().toString(),
		};

		setMessages((prev) => ({
			...prev,
			[reportId]: [...(prev[reportId] || []), newMessage],
		}));

		const syncStatus = syncService.getSyncStatus();
		if (!syncStatus.isOnline) {
			syncService.addPendingOperation({
				type: "add_message",
				data: { reportId, message: newMessage },
				shelterId: shelterId,
			});
		}
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

		const syncStatus = syncService.getSyncStatus();
		if (!syncStatus.isOnline) {
			syncService.addPendingOperation({
				type: "update_status",
				data: { reportId, status },
				shelterId: shelterId,
			});
		}
	};

	const selectedReportData = reports.find((r) => r.id === selectedReport);
	const currentShelter = shelterId
		? shelterData[shelterId as keyof typeof shelterData]
		: null;
	const shelterName = currentShelter?.name || "避難所管理システム";
	const shelterPopulation = currentShelter?.population || 127;

	return (
		<div className="container mx-auto p-4 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<AlertTriangle className="h-8 w-8 text-primary" />
					<div>
						<h1 className="text-3xl font-bold text-foreground">
							{shelterName}
						</h1>
						<p className="text-muted-foreground">
							{currentShelter
								? `${currentShelter.location} - 災害時情報共有・報告システム`
								: "災害時情報共有・報告システム"}
						</p>
						{/* API データのデバッグ情報 */}
						<div className="text-xs text-green-600 mt-1">
							API接続状況:
							{sheltersData
								? ` 避難所一覧(${sheltersData.shelterCount}件)`
								: " 避難所一覧(未取得)"}
							{shelterDetails
								? ` | 詳細(${shelterDetails.name})`
								: " | 詳細(未取得)"}
							{shelterPosts
								? ` | 投稿(${shelterPosts.posts.length}件)`
								: " | 投稿(未取得)"}
						</div>
					</div>
				</div>
				<SyncStatus />
			</div>

			{/* Status Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">避難所数</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{sheltersData ? sheltersData.shelterCount : shelterPopulation}
							{sheltersData ? "箇所" : "人"}
						</div>
						<p className="text-xs text-muted-foreground">
							{sheltersData ? "API取得済み" : "前回更新: 30分前"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							{shelterPosts ? "投稿数" : "未対応報告"}
						</CardTitle>
						<AlertTriangle className="h-4 w-4 text-destructive" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-destructive">
							{shelterPosts
								? shelterPosts.posts.length
								: reports.filter((r) => r.status === "unassigned").length}
							件
						</div>
						<p className="text-xs text-muted-foreground">
							{shelterPosts ? "API取得済み投稿" : "緊急対応が必要"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">API接続状況</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">
							{shelterDetails ? "接続中" : "未接続"}
						</div>
						<p className="text-xs text-muted-foreground">
							{shelterDetails ? `${shelterDetails.name}` : "APIデータ取得待ち"}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Main Content */}
			<Tabs defaultValue="reports" className="space-y-4">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="reports" className="flex items-center gap-2">
						<FileText className="h-4 w-4" />
						報告管理
					</TabsTrigger>
					<TabsTrigger value="chat" className="flex items-center gap-2">
						<MessageSquare className="h-4 w-4" />
						フリーチャット
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
							onAddMessage={handleAddMessage}
							onUpdateReportStatus={handleUpdateReportStatus}
							postDetail={selectedPostDetail}
							isLoadingPostDetail={isLoadingPostDetail}
						/>
					) : (
						<Card>
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
											{reports.map((report) => (
												<tr
													key={report.id}
													className="border-b hover:bg-muted/50 cursor-pointer"
													onClick={() => setSelectedReport(report.id)}
												>
													<td className="p-4">{report.datetime}</td>
													<td className="p-4">{report.address}</td>
													<td className="p-4">{report.details}</td>
													<td className="p-4">
														<Badge className={getStatusColor(report.status)}>
															{report.status === "unassigned"
																? "未対応"
																: report.status === "in-progress"
																	? "対応中"
																	: "解決済み"}
														</Badge>
													</td>
													<td className="p-4">{report.reporter}</td>
													<td className="p-4">{report.attachment || "-"}</td>
													<td className="p-4">{report.responder}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</CardContent>
						</Card>
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
										<span>未対応</span>
									</div>
									<div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#f59e0b" }}
										></div>
										<span>対応中</span>
									</div>
									{/* <div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#3b82f6" }}
										></div>
										<span>監視中</span>
									</div> */}
									<div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#10b981" }}
										></div>
										<span>解決済み</span>
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
										<span>未対応</span>
									</div>
									<div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#f59e0b" }}
										></div>
										<span>対応中</span>
									</div>
									{/* <div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#3b82f6" }}
										></div>
										<span>監視中</span>
									</div> */}
									<div className="flex items-center space-x-2">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: "#10b981" }}
										></div>
										<span>解決済み</span>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
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
