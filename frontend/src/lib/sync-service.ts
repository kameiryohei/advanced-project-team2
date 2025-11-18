interface SyncData {
	reports: any[];
	messages: { [key: string]: any[] };
	shelterStatus: any[];
	lastSync: string;
}

interface PendingOperation {
	id: string;
	type: "create_report" | "add_message" | "update_status";
	data: any;
	timestamp: string;
	shelterId?: string;
}

class SyncService {
	private static instance: SyncService;
	private pendingOperations: PendingOperation[] = [];
	private syncCallbacks: ((data: SyncData) => void)[] = [];
	private isOnline: boolean = navigator.onLine;
	private syncInProgress = false;

	private constructor() {
		// Listen for online/offline events
		window.addEventListener("online", this.handleOnline.bind(this));
		window.addEventListener("offline", this.handleOffline.bind(this));

		// Load pending operations from localStorage
		this.loadPendingOperations();
	}

	static getInstance(): SyncService {
		if (!SyncService.instance) {
			SyncService.instance = new SyncService();
		}
		return SyncService.instance;
	}

	// Save data to localStorage for offline access
	saveToLocal(key: string, data: any): void {
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
	loadFromLocal(key: string): any {
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
		const syncData: SyncData = {
			reports: this.loadFromLocal("reports") || [],
			messages: this.loadFromLocal("messages") || {},
			shelterStatus: this.loadFromLocal("shelter_status") || [],
			lastSync: new Date().toISOString(),
		};

		this.syncCallbacks.forEach((callback) => callback(syncData));
	}

	// Get current sync status
	getSyncStatus(): {
		isOnline: boolean;
		pendingOperations: number;
		syncInProgress: boolean;
		lastSync: string | null;
	} {
		return {
			isOnline: this.isOnline,
			pendingOperations: this.pendingOperations.length,
			syncInProgress: this.syncInProgress,
			lastSync: this.loadFromLocal("last_sync"),
		};
	}

	// Force sync (manual trigger)
	async forcSync(): Promise<void> {
		if (this.isOnline) {
			await this.syncPendingOperations();
		}
	}
}

export const syncService = SyncService.getInstance();
