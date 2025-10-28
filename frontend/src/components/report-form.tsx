"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Upload, Calendar, MapPin, User, AlertTriangle } from "lucide-react"

interface ReportFormProps {
  onClose: () => void
  onSubmit: (report: any) => void
}

export function ReportForm({ onClose, onSubmit }: ReportFormProps) {
  const [formData, setFormData] = useState({
    datetime: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm format
    address: "",
    details: "",
    status: "unassigned",
    reporter: "",
    attachment: null as File | null,
    responder: "未対応",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Format datetime to match the expected format
    const formattedDatetime = new Date(formData.datetime)
      .toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/\//g, "/")
      .replace(",", "")

    const reportData = {
      id: Date.now().toString(),
      datetime: formattedDatetime,
      address: formData.address,
      details: formData.details,
      status: formData.status,
      reporter: formData.reporter,
      attachment: formData.attachment ? formData.attachment.name : undefined,
      responder: formData.responder,
    }

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    onSubmit(reportData)
    setIsSubmitting(false)
    onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({ ...prev, attachment: file }))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">新規災害報告</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date and Time */}
            <div className="space-y-2">
              <Label htmlFor="datetime" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                発生日時
              </Label>
              <Input
                id="datetime"
                type="datetime-local"
                value={formData.datetime}
                onChange={(e) => setFormData((prev) => ({ ...prev, datetime: e.target.value }))}
                required
                className="w-full"
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                発生場所・住所
              </Label>
              <Input
                id="address"
                type="text"
                placeholder="例: 愛知県名古屋市中区栄1-1-1"
                value={formData.address}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                required
                className="w-full"
              />
            </div>

            {/* Details */}
            <div className="space-y-2">
              <Label htmlFor="details">詳細情報</Label>
              <Textarea
                id="details"
                placeholder="被害の詳細、状況、必要な支援内容などを具体的に記入してください"
                value={formData.details}
                onChange={(e) => setFormData((prev) => ({ ...prev, details: e.target.value }))}
                required
                className="min-h-[100px] resize-none"
              />
            </div>

            {/* Reporter */}
            <div className="space-y-2">
              <Label htmlFor="reporter" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                報告者名
              </Label>
              <Input
                id="reporter"
                type="text"
                placeholder="お名前を入力してください"
                value={formData.reporter}
                onChange={(e) => setFormData((prev) => ({ ...prev, reporter: e.target.value }))}
                required
                className="w-full"
              />
            </div>

            {/* Priority/Status */}
            <div className="space-y-2">
              <Label htmlFor="status">緊急度</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="緊急度を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-destructive"></div>
                      緊急 - 即座に対応が必要
                    </div>
                  </SelectItem>
                  <SelectItem value="in-progress">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-secondary"></div>
                      重要 - 早急な対応が必要
                    </div>
                  </SelectItem>
                  <SelectItem value="monitoring">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-chart-2"></div>
                      通常 - 通常の対応で可
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File Attachment */}
            <div className="space-y-2">
              <Label htmlFor="attachment" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                添付ファイル（写真・動画など）
              </Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  id="attachment"
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="attachment"
                  className="flex flex-col items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Upload className="h-8 w-8" />
                  <span className="text-sm">
                    {formData.attachment ? formData.attachment.name : "ファイルを選択またはドラッグ&ドロップ"}
                  </span>
                  <span className="text-xs">画像・動画ファイル対応</span>
                </label>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 bg-transparent"
                disabled={isSubmitting}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? "送信中..." : "報告を送信"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
