import { axiosInstance } from "@/api/axios-instance";
import {
	getApiSyncStatus,
	postApiSyncExecute,
	postApiSyncPullExecute,
} from "@/api/generated/team2API";
import type {
	SyncStatusResponse,
	SyncExecuteResponse,
	SyncPullExecuteResponse,
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
	type: "api_request";
	request: {
		method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
		url: string;
		data?: unknown;
	};
	timestamp: string;
}

// DB同期統計型（Orval生成型を再エクスポート）
export type DbSyncStats = SyncStatusResponse;

// DB同期結果型（Orval生成型を再エクスポート）
export type DbSyncResult = SyncExecuteResponse;

// DB差分Pull結果型（Orval生成型を再エクスポート）
export type DbPullResult = SyncPullExecuteResponse;

type MediaSyncResult = {
	success: boolean;
	total: number;
	mediaSynced: number;
	failed: number;
	errors?: Array<{
		mediaId: string;
		filePath: string;
		error: string;
	}>;
};

class SyncService {
	private static instance: SyncService;
	private pendingOperations: PendingOperation[] = [];
	private syncCallbacks: ((data: SyncData) => void)[] = [];
	private isOnline: boolean = navigator.onLine;
	private syncInProgress = false;
	private startupSyncTriggered = false;
	private pullInProgress = false;
	private pullIntervalId: number | null = null;
	private readonly pendingOperationsKey = "pending_operations";
	private readonly pullIntervalMs = 30 * 60 * 1000;

	private setEnvironmentClass(): void {
		if (typeof document === "undefined") {
			return;
		}
		const isLocal = import.meta.env.VITE_NODE_ENV === "local";
		document.documentElement.classList.toggle("local-env", isLocal);
	}

	private constructor() {
		// Listen for online/offline events
		window.addEventListener("online", this.handleOnline.bind(this));
		window.addEventListener("offline", this.handleOffline.bind(this));

		// Load pending operations from localStorage
		this.loadPendingOperations();
		this.setEnvironmentClass();

		// Fire once on app startup in production
		void this.triggerStartupSync();
		this.setupPullScheduler();
		void this.triggerStartupPull();
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

	// Public helper to queue arbitrary API requests when offline
	queueApiRequest(request: PendingOperation["request"]): void {
		this.addPendingOperation({
			type: "api_request",
			request,
		});
	}

	// Save pending operations to localStorage
	private savePendingOperations(): void {
		this.saveToLocal(this.pendingOperationsKey, this.pendingOperations);
	}

	// Load pending operations from localStorage
	private loadPendingOperations(): void {
		const stored = this.loadFromLocal(this.pendingOperationsKey);
		if (stored && Array.isArray(stored)) {
			this.pendingOperations = stored;
		}
	}

	// Upgrade legacy pending ops (old shapes) to the new api_request format
	private normalizeLegacyOperations(): void {
		if (!this.pendingOperations || this.pendingOperations.length === 0) {
			return;
		}

		const migrated: PendingOperation[] = [];
		let migratedCount = 0;
		let droppedCount = 0;

		for (const op of this.pendingOperations) {
			// Already new shape
			if (op.type === "api_request" && "request" in op) {
				migrated.push(op);
				continue;
			}

			// Legacy shapes: missing request or old type values
			const legacy = op as {
				type?: string;
				data?: unknown;
				shelterId?: string | number | null;
			};

			let mapped: PendingOperation | null = null;
			if (legacy.type === "create_report") {
				mapped = {
					id: Date.now().toString(),
					timestamp: new Date().toISOString(),
					type: "api_request",
					request: {
						method: "POST",
						url: "/posts",
						data: legacy.data,
					},
				};
			} else if (legacy.type === "add_message") {
				const shelterId = legacy.shelterId ?? "";
				mapped = {
					id: Date.now().toString(),
					timestamp: new Date().toISOString(),
					type: "api_request",
					request: {
						method: "POST",
						url: `/shelters/${shelterId}/messages`,
						data: legacy.data,
					},
				};
			} else if (legacy.type === "update_status") {
				mapped = {
					id: Date.now().toString(),
					timestamp: new Date().toISOString(),
					type: "api_request",
					request: {
						method: "PATCH",
						url: "/reports/status",
						data: legacy.data,
					},
				};
			}

			if (mapped) {
				migrated.push(mapped);
				migratedCount++;
			} else {
				droppedCount++;
			}
		}

		this.pendingOperations = migrated;
		this.savePendingOperations();

		if (migratedCount > 0 || droppedCount > 0) {
			console.log(
				`[SyncService] Legacy pending ops normalized. migrated=${migratedCount}, dropped=${droppedCount}`,
			);
		}
	}

	// Handle online event
	private async handleOnline(): Promise<void> {
		console.log("[v0] Connection restored - starting sync");
		this.isOnline = true;
		this.normalizeLegacyOperations();
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
			"[SyncService] Syncing",
			this.pendingOperations.length,
			"pending operations",
		);

		try {
			const remaining: PendingOperation[] = [];

			for (const op of this.pendingOperations) {
				if (op.type !== "api_request") {
					console.warn("[SyncService] Unknown pending op type, dropping:", op);
					continue;
				}

				try {
					await axiosInstance({
						method: op.request.method,
						url: op.request.url,
						data: op.request.data,
					});
					console.log(
						"[SyncService] ✅ Pending API request success:",
						op.request.url,
					);
				} catch (error) {
					console.error(
						"[SyncService] ❌ Pending API request failed, keeping in queue:",
						op.request.url,
						error,
					);
					remaining.push(op);
				}
			}

			this.pendingOperations = remaining;
			this.savePendingOperations();

			if (remaining.length === 0) {
				this.notifySyncComplete();
				console.log("[SyncService] Sync completed successfully");
			}
		} catch (error) {
			console.error("[SyncService] Sync failed:", error);
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

	private shouldEnablePull(): boolean {
		// VITE_ENABLE_PULL_SYNC環境変数で明示的に制御
		const enablePull = import.meta.env.VITE_ENABLE_PULL_SYNC;
		if (enablePull === "true" || enablePull === "1") {
			return true;
		}
		if (enablePull === "false" || enablePull === "0") {
			return false;
		}
		// 未設定の場合はローカル環境のみ有効
		return import.meta.env.VITE_NODE_ENV === "local";
	}

	private getDefaultShelterIdForPull(): number | null {
		const rawShelterId = import.meta.env.VITE_DEFAULT_SHELTER_ID;
		if (!rawShelterId) {
			return null;
		}
		const shelterId = Number.parseInt(rawShelterId, 10);
		return Number.isNaN(shelterId) ? null : shelterId;
	}

	private setupPullScheduler(): void {
		if (!this.shouldEnablePull() || this.pullIntervalId !== null) {
			return;
		}
		this.pullIntervalId = window.setInterval(() => {
			if (this.isOnline) {
				void this.syncPullFromProduction();
			}
		}, this.pullIntervalMs);
	}

	private async triggerStartupPull(): Promise<void> {
		if (!this.shouldEnablePull()) {
			return;
		}
		if (!navigator.onLine) {
			return;
		}
		await this.syncPullFromProduction();
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
	 * 本番DBから差分をPullしてローカルへ反映
	 */
	async syncPullFromProduction(): Promise<DbPullResult | null> {
		if (!this.shouldEnablePull() || this.pullInProgress) {
			return null;
		}
		const productionApiUrl = import.meta.env.VITE_PRODUCTION_API_URL;
		const shelterId = this.getDefaultShelterIdForPull();
		if (!productionApiUrl || !shelterId) {
			return null;
		}

		this.pullInProgress = true;
		try {
			const result = await postApiSyncPullExecute({
				targetUrl: productionApiUrl,
				shelterId,
			});

			if (result.success) {
				console.log(
					`[SyncService] ✅ 差分Pull完了: posts=${result.postsPulled}, comments=${result.commentsPulled}, tracks=${result.locationTracksPulled}, media=${result.mediaPulled}, mediaSynced=${result.mediaSynced}${result.mediaFailed > 0 ? `, mediaFailed=${result.mediaFailed}` : ""}`,
				);
			} else {
				console.warn("[SyncService] ⚠️ 差分Pull失敗:", result.error);
			}

			return result;
		} catch (error) {
			console.error("[SyncService] ❌ 差分Pullエラー:", error);
			return null;
		} finally {
			this.pullInProgress = false;
		}
	}

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
				mediaSynced: 0,
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
					result.locationTracksSynced +
					result.mediaSynced;

				toast.success("同期完了", {
					id: "db-sync-toast",
					description: `${totalSynced}件のデータを同期しました（投稿: ${result.postsSynced}, コメント: ${result.commentsSynced}, 位置情報: ${result.locationTracksSynced}, メディア: ${result.mediaSynced}）`,
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
				mediaSynced: 0,
				error: message,
			};
		}
	}

	/**
	 * メディアを本番R2に同期
	 */
	async syncMediaToProduction(): Promise<MediaSyncResult | null> {
		try {
			const productionApiUrl = import.meta.env.VITE_PRODUCTION_API_URL;
			if (!productionApiUrl) {
				return null;
			}

			const result = await axiosInstance<MediaSyncResult>({
				url: "/api/sync/media",
				method: "POST",
				data: {
					targetUrl: productionApiUrl,
				},
			});

			if (result.success) {
				console.log(
					`[SyncService] ✅ メディア同期完了: ${result.mediaSynced}/${result.total}`,
				);
			} else {
				console.log(
					`[SyncService] ⚠️ メディア同期失敗: ${result.failed}/${result.total}`,
				);
			}

			return result;
		} catch (error) {
			console.error("[SyncService] ❌ メディア同期エラー:", error);
			return null;
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
				`[SyncService] ✅ 自動同期完了: ${result.postsSynced}件の投稿, ${result.commentsSynced}件のコメント, ${result.locationTracksSynced}件の位置情報, ${result.mediaSynced}件のメディア`,
			);
		}

		await this.syncMediaToProduction();
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
			// 先に保留中のリクエストを処理してから本番同期
			this.normalizeLegacyOperations();
			await this.syncPendingOperations();
			await this.autoSyncOnOnline();
		} catch (error) {
			console.error("[SyncService] ❌ 起動時同期エラー:", error);
		}
	}
}

export const syncService = SyncService.getInstance();
