"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Wifi,
	WifiOff,
	RefreshCw,
	Clock,
	Database,
	CloudUpload,
	AlertCircle,
	CheckCircle,
} from "lucide-react";
import {
	syncService,
	type DbSyncStats,
	type DbSyncResult,
} from "@/lib/sync-service";

export function SyncStatus() {
	const [syncStatus, setSyncStatus] = useState(syncService.getSyncStatus());
	const [lastUpdate, setLastUpdate] = useState<string>("");
	const [dbSyncStats, setDbSyncStats] = useState<DbSyncStats | null>(null);
	const [isDbSyncing, setIsDbSyncing] = useState(false);
	const [lastDbSyncResult, setLastDbSyncResult] = useState<DbSyncResult | null>(
		null,
	);

	useEffect(() => {
		const updateStatus = () => {
			const status = syncService.getSyncStatus();
			setSyncStatus(status);
			setLastUpdate(new Date().toLocaleTimeString("ja-JP"));
		};

		// DB同期ステータスを取得
		const fetchDbSyncStats = async () => {
			const stats = await syncService.getDbSyncStats();
			setDbSyncStats(stats);
		};

		// Update status every 5 seconds
		const interval = setInterval(() => {
			updateStatus();
			fetchDbSyncStats();
		}, 5000);

		// 初回取得
		updateStatus();
		fetchDbSyncStats();

		// Listen for sync completion
		syncService.onSyncComplete(() => {
			updateStatus();
		});

		return () => clearInterval(interval);
	}, []);

	const handleForceSync = async () => {
		await syncService.forcSync();
		setSyncStatus(syncService.getSyncStatus());
	};

	// DB同期を手動で実行
	const handleDbSync = async () => {
		setIsDbSyncing(true);
		setLastDbSyncResult(null);

		try {
			const result = await syncService.syncDbToProduction();
			setLastDbSyncResult(result);

			// 同期後に統計を再取得
			const stats = await syncService.getDbSyncStats();
			setDbSyncStats(stats);
		} finally {
			setIsDbSyncing(false);
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-3">
			{/* Connection Status */}
			<div className="flex items-center gap-2">
				{syncStatus.isOnline ? (
					<div className="flex items-center gap-1 text-success">
						<Wifi className="h-4 w-4" />
						<span className="text-sm font-medium">オンライン</span>
					</div>
				) : (
					<div className="flex items-center gap-1 text-danger">
						<WifiOff className="h-4 w-4" />
						<span className="text-sm font-medium">オフライン</span>
					</div>
				)}
			</div>

			{/* DB Unsynced Data Count */}
			{dbSyncStats && dbSyncStats.totalUnsynced > 0 && (
				<Badge
					variant="outline"
					className="flex items-center gap-1 border-orange-500 text-orange-600"
				>
					<Database className="h-3 w-3" />
					<span>未同期: {dbSyncStats.totalUnsynced}件</span>
				</Badge>
			)}

			{/* Pending Operations (localStorage) */}
			{syncStatus.pendingOperations > 0 && (
				<Badge variant="outline" className="flex items-center gap-1">
					<Clock className="h-3 w-3" />
					<span>ローカル待機: {syncStatus.pendingOperations}</span>
				</Badge>
			)}

			{/* Sync in Progress */}
			{(syncStatus.syncInProgress || isDbSyncing) && (
				<Badge className="flex items-center gap-1 bg-info text-info-foreground">
					<RefreshCw className="h-3 w-3 animate-spin" />
					<span>{isDbSyncing ? "DB同期中..." : "同期中..."}</span>
				</Badge>
			)}

			{/* Last DB Sync Result */}
			{lastDbSyncResult && (
				<Badge
					variant="outline"
					className={`flex items-center gap-1 ${
						lastDbSyncResult.success
							? "border-green-500 text-green-600"
							: "border-red-500 text-red-600"
					}`}
				>
					{lastDbSyncResult.success ? (
						<>
							<CheckCircle className="h-3 w-3" />
							<span>
								同期完了 (
								{lastDbSyncResult.postsSynced +
									lastDbSyncResult.commentsSynced +
									lastDbSyncResult.locationTracksSynced}
								件)
							</span>
						</>
					) : (
						<>
							<AlertCircle className="h-3 w-3" />
							<span>同期失敗</span>
						</>
					)}
				</Badge>
			)}

			{/* DB Sync Button */}
			<Button
				variant="outline"
				size="sm"
				onClick={handleDbSync}
				disabled={
					!syncStatus.isOnline ||
					isDbSyncing ||
					dbSyncStats?.totalUnsynced === 0
				}
				className="flex items-center gap-1 bg-transparent"
				title="ローカルDBのデータを本番環境に同期"
			>
				<CloudUpload
					className={`h-3 w-3 ${isDbSyncing ? "animate-pulse" : ""}`}
				/>
				<span>本番同期</span>
			</Button>

			{/* Manual Sync Button */}
			<Button
				variant="outline"
				size="sm"
				onClick={handleForceSync}
				disabled={!syncStatus.isOnline || syncStatus.syncInProgress}
				className="flex items-center gap-1 bg-transparent"
			>
				<RefreshCw
					className={`h-3 w-3 ${syncStatus.syncInProgress ? "animate-spin" : ""}`}
				/>
				<span>同期</span>
			</Button>

			{/* Last Update */}
			{lastUpdate && (
				<span className="text-xs text-muted-foreground">
					更新: {lastUpdate}
				</span>
			)}
		</div>
	);
}
