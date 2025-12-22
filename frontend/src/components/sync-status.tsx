import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Wifi,
	WifiOff,
	RefreshCw,
	Clock,
	Database,
	AlertCircle,
} from "lucide-react";
import { syncService, type DbSyncStats } from "@/lib/sync-service";

export function SyncStatus() {
	const [syncStatus, setSyncStatus] = useState(syncService.getSyncStatus());
	const [lastUpdate, setLastUpdate] = useState<string>("");
	const [dbSyncStats, setDbSyncStats] = useState<DbSyncStats | null>(null);
	const isLocal = import.meta.env.VITE_NODE_ENV === "local";

	useEffect(() => {
		const updateStatus = () => {
			const status = syncService.getSyncStatus();
			setSyncStatus(status);
			setLastUpdate(new Date().toLocaleTimeString("ja-JP"));
		};

		// DB同期ステータスを取得
		const fetchDbSyncStats = async () => {
			if (!isLocal) {
				return;
			}
			const stats = await syncService.getDbSyncStats();
			setDbSyncStats(stats);
		};

		// Update status every 30 seconds
		const interval = setInterval(() => {
			updateStatus();
			if (isLocal) {
				fetchDbSyncStats();
			}
		}, 30000);

		// 初回取得
		updateStatus();
		if (isLocal) {
			fetchDbSyncStats();
		}

		// Listen for sync completion
		syncService.onSyncComplete(() => {
			updateStatus();
		});

		return () => clearInterval(interval);
	}, []);

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
			{isLocal &&
				!syncStatus.isOnline &&
				dbSyncStats &&
				dbSyncStats.totalUnsynced > 0 && (
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
			{syncStatus.syncInProgress && (
				<Badge className="flex items-center gap-1 bg-info text-info-foreground">
					<RefreshCw className="h-3 w-3 animate-spin" />
					<span>同期中...</span>
				</Badge>
			)}

			{/* Auto Sync Info */}
			{isLocal &&
				!syncStatus.isOnline &&
				dbSyncStats &&
				dbSyncStats.totalUnsynced > 0 && (
					<Badge
						variant="outline"
						className="flex items-center gap-1 text-muted-foreground"
					>
						<AlertCircle className="h-3 w-3" />
						<span>オンライン復帰時に自動同期されます</span>
					</Badge>
				)}

			{/* Last Update */}
			{lastUpdate && (
				<span className="text-xs text-muted-foreground">
					更新: {lastUpdate}
				</span>
			)}
		</div>
	);
}
