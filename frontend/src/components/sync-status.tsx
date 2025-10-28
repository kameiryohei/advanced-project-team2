"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wifi, WifiOff, RefreshCw, Clock } from "lucide-react"
import { syncService } from "@/lib/sync-service"

export function SyncStatus() {
  const [syncStatus, setSyncStatus] = useState(syncService.getSyncStatus())
  const [lastUpdate, setLastUpdate] = useState<string>("")

  useEffect(() => {
    const updateStatus = () => {
      const status = syncService.getSyncStatus()
      setSyncStatus(status)
      setLastUpdate(new Date().toLocaleTimeString("ja-JP"))
    }

    // Update status every 5 seconds
    const interval = setInterval(updateStatus, 5000)

    // Listen for sync completion
    syncService.onSyncComplete(() => {
      updateStatus()
    })

    return () => clearInterval(interval)
  }, [])

  const handleForceSync = async () => {
    await syncService.forcSync()
    setSyncStatus(syncService.getSyncStatus())
  }

  return (
    <div className="flex items-center gap-3">
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

      {/* Pending Operations */}
      {syncStatus.pendingOperations > 0 && (
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>同期待ち: {syncStatus.pendingOperations}</span>
        </Badge>
      )}

      {/* Sync in Progress */}
      {syncStatus.syncInProgress && (
        <Badge className="flex items-center gap-1 bg-info text-info-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>同期中...</span>
        </Badge>
      )}

      {/* Manual Sync Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleForceSync}
        disabled={!syncStatus.isOnline || syncStatus.syncInProgress}
        className="flex items-center gap-1 bg-transparent"
      >
        <RefreshCw className={`h-3 w-3 ${syncStatus.syncInProgress ? "animate-spin" : ""}`} />
        <span>同期</span>
      </Button>

      {/* Last Update */}
      {lastUpdate && <span className="text-xs text-muted-foreground">更新: {lastUpdate}</span>}
    </div>
  )
}
