import { getApiSyncStatus, postApiSyncExecute } from "@/api/generated/team2API";
import type {
	SyncStatusResponse,
	SyncExecuteResponse,
} from "@/api/generated/model";
import { toast } from "sonner";

// 既存のローカルストレージデータ型
interface SyncData {
	reports: unknown[];
	messages: { [key: string]: unknown[] };
	shelterStatus: unknown[];
	lastSync: string;
}

interface PendingOperation {
	id: string;
	type: "create_report" | "add_message" | "update_status";
	data: unknown;
	timestamp: string;
	shelterId?: string;
}

// DB同期統計型（Orval生成型を再エクスポート）
export type DbSyncStats = SyncStatusResponse;

// DB同期結果型（Orval生成型を再エクスポート）
export type DbSyncResult = SyncExecuteResponse;

class SyncService {
	private static instance: SyncService;
	private pendingOperations: PendingOperation[] = [];
	private syncCallbacks: ((data: SyncData) => void)[] = [];
	private isOnline: boolean = navigator.onLine;
	private syncInProgress = false;
	private startupSyncTriggered = false;

	private constructor() {
		// Listen for online/offline events
		window.addEventListener("online", this.handleOnline.bind(this));
		window.addEventListener("offline", this.handleOffline.bind(this));

		// Load pending operations from localStorage
		this.loadPendingOperations();

		// Fire once on app startup in production
		void this.triggerStartupSync();
	}

	static getInstance(): SyncService {
		if (!SyncService.instance) {
			SyncService.instance = new SyncService();
		}
		return SyncService.instance;
	}

	// Save data to localStorage for offline access
	saveToLocal(key: string, data: unknown): void {
		try {
			localStorage.setItem(
				`disaster_system_${key}`,
				JSON.stringify({
					data,
					timestamp: new Date().toISOString(),
				}),
			);
		} catch (error) {
			console.error("[v0] Failed to save to localStorage:", error);
		}
	}

	// Load data from localStorage
	loadFromLocal(key: string): unknown {
		try {
			const stored = localStorage.getItem(`disaster_system_${key}`);
			if (stored) {
				const parsed = JSON.parse(stored);
				return parsed.data;
			}
		} catch (error) {
			console.error("[v0] Failed to load from localStorage:", error);
		}
		return null;
	}

	// Add operation to pending queue when offline
	addPendingOperation(
		operation: Omit<PendingOperation, "id" | "timestamp">,
	): void {
		const pendingOp: PendingOperation = {
			...operation,
			id: Date.now().toString(),
			timestamp: new Date().toISOString(),
		};

		this.pendingOperations.push(pendingOp);
		this.savePendingOperations();

		console.log("[v0] Added pending operation:", pendingOp.type);
	}

	// Save pending operations to localStorage
	private savePendingOperations(): void {
		this.saveToLocal("pending_operations", this.pendingOperations);
	}

	// Load pending operations from localStorage
	private loadPendingOperations(): void {
		const stored = this.loadFromLocal("pending_operations");
		if (stored && Array.isArray(stored)) {
			this.pendingOperations = stored;
		}
	}

	// Handle online event
	private async handleOnline(): Promise<void> {
		console.log("[v0] Connection restored - starting sync");
		this.isOnline = true;
		await this.syncPendingOperations();
		// オンライン復帰時にDB同期も試行
		await this.autoSyncOnOnline();
	}

	// Handle offline event
	private handleOffline(): void {
		console.log("[v0] Connection lost - switching to offline mode");
		this.isOnline = false;
	}

	// Sync all pending operations when back online
	private async syncPendingOperations(): Promise<void> {
		if (this.syncInProgress || this.pendingOperations.length === 0) {
			return;
		}

		this.syncInProgress = true;
		console.log(
			"[v0] Syncing",
			this.pendingOperations.length,
			"pending operations",
		);

		try {
			// In a real implementation, this would send data to the server
			// For now, we'll simulate the sync process
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Clear pending operations after successful sync
			this.pendingOperations = [];
			this.savePendingOperations();

			// Notify components about successful sync
			this.notifySyncComplete();

			console.log("[v0] Sync completed successfully");
		} catch (error) {
			console.error("[v0] Sync failed:", error);
		} finally {
			this.syncInProgress = false;
		}
	}

	// Register callback for sync completion
	onSyncComplete(callback: (data: SyncData) => void): void {
		this.syncCallbacks.push(callback);
	}

	// Notify all registered callbacks
	private notifySyncComplete(): void {
		const reports = this.loadFromLocal("reports");
		const messages = this.loadFromLocal("messages");
		const shelterStatus = this.loadFromLocal("shelter_status");

		const syncData: SyncData = {
			reports: Array.isArray(reports) ? reports : [],
			messages:
				messages && typeof messages === "object" && !Array.isArray(messages)
					? (messages as { [key: string]: unknown[] })
					: {},
			shelterStatus: Array.isArray(shelterStatus) ? shelterStatus : [],
			lastSync: new Date().toISOString(),
		};

		for (const callback of this.syncCallbacks) {
			callback(syncData);
		}
	}

	// Get current sync status
	getSyncStatus(): {
		isOnline: boolean;
		pendingOperations: number;
		syncInProgress: boolean;
		lastSync: string | null;
	} {
		const lastSync = this.loadFromLocal("last_sync");
		return {
			isOnline: this.isOnline,
			pendingOperations: this.pendingOperations.length,
			syncInProgress: this.syncInProgress,
			lastSync: typeof lastSync === "string" ? lastSync : null,
		};
	}

	// Force sync (manual trigger)
	async forcSync(): Promise<void> {
		if (this.isOnline) {
			await this.syncPendingOperations();
		}
	}

	// ==================== DB同期機能 ====================

	/**
	 * バックエンドDBの同期ステータスを取得
	 */
	async getDbSyncStats(): Promise<DbSyncStats | null> {
		try {
			const response = await getApiSyncStatus();
			return response;
		} catch (error) {
			console.error("[SyncService] DB同期ステータス取得エラー:", error);
			return null;
		}
	}

	/**
	 * 本番APIが利用可能かチェック
	 */
	async checkProductionApiAvailable(): Promise<boolean> {
		const productionApiUrl = import.meta.env.VITE_PRODUCTION_API_URL;
		if (!productionApiUrl) {
			return false;
		}

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000);

			const response = await fetch(productionApiUrl, {
				method: "GET",
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * DBデータを本番環境に同期
	 */
	async syncDbToProduction(shelterId?: number): Promise<DbSyncResult> {
		const productionApiUrl = import.meta.env.VITE_PRODUCTION_API_URL;

		if (!productionApiUrl) {
			const errorMsg = "本番API URLが設定されていません";
			toast.error("同期失敗", {
				description: errorMsg,
			});
			return {
				success: false,
				postsSynced: 0,
				commentsSynced: 0,
				locationTracksSynced: 0,
				error: errorMsg,
			};
		}

		console.log("[SyncService] 🔄 DB同期開始...");
		if (shelterId) {
			console.log("[SyncService] 🏠 避難所ID:", shelterId);
		}
		toast.loading("同期中...", {
			id: "db-sync-toast",
			description: "データを本番環境に同期しています",
		});

		try {
			const result = await postApiSyncExecute({
				targetUrl: productionApiUrl,
				shelterId: shelterId,
			});

			console.log("[SyncService] ✅ DB同期完了:", result);

			if (result.success) {
				const totalSynced =
					result.postsSynced +
					result.commentsSynced +
					result.locationTracksSynced;

				toast.success("同期完了", {
					id: "db-sync-toast",
					description: `${totalSynced}件のデータを同期しました（投稿: ${result.postsSynced}, コメント: ${result.commentsSynced}, 位置情報: ${result.locationTracksSynced}）`,
				});
			} else {
				toast.error("同期失敗", {
					id: "db-sync-toast",
					description: result.error || "同期中にエラーが発生しました",
				});
			}

			// 最終同期時刻を保存
			this.saveToLocal("last_db_sync", new Date().toISOString());

			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error("[SyncService] ❌ DB同期エラー:", error);

			toast.error("同期エラー", {
				id: "db-sync-toast",
				description: message,
			});

			return {
				success: false,
				postsSynced: 0,
				commentsSynced: 0,
				locationTracksSynced: 0,
				error: message,
			};
		}
	}

	/**
	 * オンライン復帰時に自動的にDB同期を実行
	 */
	async autoSyncOnOnline(): Promise<void> {
		console.log("[SyncService] 🌐 オンライン復帰を検知、自動同期を試行...");

		// 本番APIが利用可能かチェック
		const isProductionAvailable = await this.checkProductionApiAvailable();
		if (!isProductionAvailable) {
			console.log("[SyncService] ℹ️ 本番APIが利用不可、同期をスキップ");
			return;
		}

		// ローカルストレージから現在の避難所IDを取得
		const shelterId = this.loadFromLocal("current_shelter_id") as number | null;

		// DB同期を実行
		const result = await this.syncDbToProduction(shelterId || undefined);
		if (result.success) {
			console.log(
				`[SyncService] ✅ 自動同期完了: ${result.postsSynced}件の投稿, ${result.commentsSynced}件のコメント, ${result.locationTracksSynced}件の位置情報`,
			);
		}
	}

	private async triggerStartupSync(): Promise<void> {
		const isLocal = import.meta.env.VITE_NODE_ENV === "local";
		if (isLocal || this.startupSyncTriggered) {
			return;
		}

		const storageKey = "disaster_system_startup_sync_done";
		if (sessionStorage.getItem(storageKey) === "true") {
			return;
		}

		this.startupSyncTriggered = true;
		sessionStorage.setItem(storageKey, "true");

		if (!navigator.onLine) {
			return;
		}

		try {
			console.log("[SyncService] 🚀 起動時に同期を試行...");
			await this.autoSyncOnOnline();
		} catch (error) {
			console.error("[SyncService] ❌ 起動時同期エラー:", error);
		}
	}
}

export const syncService = SyncService.getInstance();
