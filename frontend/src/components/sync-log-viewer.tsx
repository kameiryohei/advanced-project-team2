import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useGetApiSyncLogs } from "@/api/generated/team2API";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SyncLogViewerProps {
	shelterId?: number;
}

export function SyncLogViewer({ shelterId }: SyncLogViewerProps) {
	const [page, setPage] = useState(1);
	const limit = 10;

	const {
		data: syncLogsData,
		isLoading,
		error,
		refetch,
	} = useGetApiSyncLogs(
		{
			shelterId: shelterId,
			page: page,
			limit: limit,
		},
		{
			query: {
				refetchInterval: 30000, // 30秒ごとに自動更新
			},
		},
	);

	const handlePreviousPage = () => {
		if (page > 1) {
			setPage(page - 1);
		}
	};

	const handleNextPage = () => {
		if (syncLogsData && page < syncLogsData.totalPages) {
			setPage(page + 1);
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "completed":
				return <Badge variant="default">完了</Badge>;
			case "failed":
				return <Badge variant="destructive">失敗</Badge>;
			case "in_progress":
				return <Badge variant="secondary">実行中</Badge>;
			case "pending":
				return <Badge variant="outline">待機中</Badge>;
			default:
				return <Badge variant="outline">{status}</Badge>;
		}
	};

	const getSyncTypeBadge = (syncType: string) => {
		switch (syncType) {
			case "full":
				return <Badge variant="secondary">全体同期</Badge>;
			case "incremental":
				return <Badge variant="secondary">差分同期</Badge>;
			case "manual":
				return <Badge variant="secondary">手動同期</Badge>;
			default:
				return <Badge variant="outline">{syncType}</Badge>;
		}
	};

	const formatDateTime = (dateString: string | null | undefined) => {
		if (!dateString) return "-";
		const date = new Date(dateString);
		return date.toLocaleString("ja-JP", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>同期ログ</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>同期ログ</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-destructive">エラー: ログの取得に失敗しました</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle>同期ログ</CardTitle>
				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					className="gap-2"
				>
					<RefreshCw className="h-4 w-4" />
					更新
				</Button>
			</CardHeader>
			<CardContent>
				{syncLogsData && syncLogsData.logs.length > 0 ? (
					<>
						<div className="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>ID</TableHead>
										{!shelterId && <TableHead>避難所</TableHead>}
										<TableHead>同期タイプ</TableHead>
										<TableHead>ステータス</TableHead>
										<TableHead>開始日時</TableHead>
										<TableHead>完了日時</TableHead>
										<TableHead className="text-right">投稿</TableHead>
										<TableHead className="text-right">コメント</TableHead>
										<TableHead className="text-right">位置情報</TableHead>
										<TableHead className="text-right">合計</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{syncLogsData.logs.map((log) => (
										<TableRow key={log.id}>
											<TableCell className="font-medium">{log.id}</TableCell>
											{!shelterId && (
												<TableCell>
													{log.shelterName || (
														<span className="text-muted-foreground">-</span>
													)}
												</TableCell>
											)}
											<TableCell>{getSyncTypeBadge(log.syncType)}</TableCell>
											<TableCell>{getStatusBadge(log.status)}</TableCell>
											<TableCell>{formatDateTime(log.startedAt)}</TableCell>
											<TableCell>{formatDateTime(log.completedAt)}</TableCell>
											<TableCell className="text-right">
												{log.postsSynced}
											</TableCell>
											<TableCell className="text-right">
												{log.commentsSynced}
											</TableCell>
											<TableCell className="text-right">
												{log.locationTracksSynced}
											</TableCell>
											<TableCell className="text-right font-medium">
												{log.totalSynced}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>

						{/* ページネーション */}
						<div className="flex items-center justify-between px-2 py-4">
							<div className="text-sm text-muted-foreground">
								{syncLogsData.totalCount} 件中 {(page - 1) * limit + 1} -{" "}
								{Math.min(page * limit, syncLogsData.totalCount)} 件を表示
							</div>
							<div className="flex items-center space-x-2">
								<Button
									variant="outline"
									size="sm"
									onClick={handlePreviousPage}
									disabled={page === 1}
								>
									<ChevronLeft className="h-4 w-4" />
									前へ
								</Button>
								<div className="text-sm">
									ページ {page} / {syncLogsData.totalPages}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={handleNextPage}
									disabled={page >= syncLogsData.totalPages}
								>
									次へ
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</>
				) : (
					<div className="text-center py-8 text-muted-foreground">
						同期ログがありません
					</div>
				)}
			</CardContent>
		</Card>
	);
}
