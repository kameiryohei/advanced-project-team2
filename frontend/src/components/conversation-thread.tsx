"use client";

import {
	ArrowLeft,
	Clock,
	MapPin,
	MessageCircle,
	Send,
	Shield,
	User,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Message {
	id: string;
	time: string;
	responder: string;
	message: string;
	status: string;
	isResponder: boolean;
}

interface Report {
	id: string;
	datetime: string;
	address: string;
	details: string;
	status: "unassigned" | "in-progress" | "monitoring" | "resolved";
	reporter: string;
	attachment?: string;
	responder?: string;
	latitude?: number;
	longitude?: number;
}

interface ConversationThreadProps {
	report: Report;
	messages: Message[];
	onBack: () => void;
	onAddMessage: (reportId: string, message: Omit<Message, "id">) => void;
	onUpdateReportStatus: (reportId: string, status: Report["status"]) => void;
}

// 地図コンポーネント
function ReportLocationMap({ report }: { report: Report }) {
	// デフォルト座標または実際の報告場所の座標
	const latitude = report.latitude || 35.6812;
	const longitude = report.longitude || 139.7671;
	const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01},${latitude - 0.01},${longitude + 0.01},${latitude + 0.01}&layer=mapnik&marker=${latitude},${longitude}`;

	return (
		<div className="relative w-full h-64 rounded-lg overflow-hidden border bg-muted">
			<iframe
				src={mapUrl}
				width="100%"
				height="100%"
				style={{ border: 0 }}
				title={`報告場所: ${report.address}`}
				className="w-full h-full"
			/>
			<div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium border">
				<MapPin className="inline h-3 w-3 mr-1" />
				{report.address}
			</div>
		</div>
	);
}

const getStatusColor = (status: string) => {
	switch (status) {
		case "unassigned":
		case "未対応":
			return "bg-destructive text-destructive-foreground";
		case "in-progress":
		case "指示あり":
		case "経過報告":
			return "bg-secondary text-secondary-foreground";
		case "monitoring":
		case "様子見中":
			return "bg-chart-2 text-foreground";
		case "resolved":
		case "報告":
			return "bg-chart-1 text-foreground";
		default:
			return "bg-muted text-muted-foreground";
	}
};

export function ConversationThread({
	report,
	messages,
	onBack,
	onAddMessage,
	onUpdateReportStatus,
}: ConversationThreadProps) {
	const [newMessage, setNewMessage] = useState("");
	const [newStatus, setNewStatus] = useState("");
	const [responderName, setResponderName] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmitMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newMessage.trim() || !responderName.trim()) return;

		setIsSubmitting(true);

		const messageData = {
			time: new Date()
				.toLocaleString("ja-JP", {
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
					hour: "2-digit",
					minute: "2-digit",
				})
				.replace(/\//g, "/")
				.replace(",", ""),
			responder: responderName,
			message: newMessage,
			status: newStatus || "経過報告",
			isResponder: responderName !== report.reporter,
		};

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 500));

		onAddMessage(report.id, messageData);

		// Update report status if new status is provided
		if (newStatus && newStatus !== report.status) {
			const statusMap: { [key: string]: Report["status"] } = {
				指示あり: "in-progress",
				経過報告: "in-progress",
				様子見中: "monitoring",
				報告: "resolved",
			};
			if (statusMap[newStatus]) {
				onUpdateReportStatus(report.id, statusMap[newStatus]);
			}
		}

		setNewMessage("");
		setNewStatus("");
		setIsSubmitting(false);
	};

	return (
		<div className="space-y-6">
			{/* Header with Report Summary */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Button variant="outline" size="sm" onClick={onBack}>
								<ArrowLeft className="h-4 w-4 mr-2" />
								一覧に戻る
							</Button>
							<div>
								<CardTitle className="text-xl">
									報告詳細 - #{report.id}
								</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">
									{report.datetime} | {report.address}
								</p>
							</div>
						</div>
						<Badge className={getStatusColor(report.status)}>
							{report.status === "unassigned"
								? "未対応"
								: report.status === "in-progress"
									? "対応中"
									: report.status === "monitoring"
										? "様子見中"
										: "解決済み"}
						</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<div>
							<h4 className="font-medium text-sm text-muted-foreground">
								報告内容
							</h4>
							<p className="text-sm">{report.details}</p>
						</div>
						<div className="flex gap-6 text-sm">
							<div>
								<span className="font-medium text-muted-foreground">
									報告者:{" "}
								</span>
								<span>{report.reporter}</span>
							</div>
							{report.attachment && (
								<div>
									<span className="font-medium text-muted-foreground">
										添付:{" "}
									</span>
									<span>{report.attachment}</span>
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MapPin className="h-5 w-5" />
						報告場所
					</CardTitle>
				</CardHeader>
				<CardContent>
					<ReportLocationMap report={report} />
				</CardContent>
			</Card>

			{/* Conversation Thread */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MessageCircle className="h-5 w-5" />
						対応履歴・やり取り
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{/* Messages */}
						<div className="space-y-3 max-h-96 overflow-y-auto">
							{messages.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
									<p>まだやり取りがありません</p>
									<p className="text-sm">最初のメッセージを送信してください</p>
								</div>
							) : (
								messages.map((message) => (
									<div
										key={message.id}
										className={`flex gap-3 ${message.isResponder ? "justify-start" : "justify-end"}`}
									>
										<div
											className={`max-w-[70%] ${message.isResponder ? "order-2" : "order-1"}`}
										>
											<div
												className={`rounded-lg p-3 ${
													message.isResponder
														? "bg-card border"
														: "bg-primary text-primary-foreground"
												}`}
											>
												<div className="flex items-center gap-2 mb-1">
													<div className="flex items-center gap-1">
														{message.isResponder ? (
															<Shield className="h-3 w-3" />
														) : (
															<User className="h-3 w-3" />
														)}
														<span className="text-xs font-medium">
															{message.responder}
														</span>
													</div>
													<Badge
														size="sm"
														className={`text-xs ${getStatusColor(message.status)}`}
													>
														{message.status}
													</Badge>
												</div>
												<p className="text-sm">{message.message}</p>
												<div className="flex items-center gap-1 mt-2 opacity-70">
													<Clock className="h-3 w-3" />
													<span className="text-xs">{message.time}</span>
												</div>
											</div>
										</div>
									</div>
								))
							)}
						</div>

						{/* New Message Form */}
						<div className="border-t pt-4">
							<form onSubmit={handleSubmitMessage} className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="responder">対応者名</Label>
										<Input
											id="responder"
											placeholder="お名前を入力"
											value={responderName}
											onChange={(e) => setResponderName(e.target.value)}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="status">ステータス更新</Label>
										<Select value={newStatus} onValueChange={setNewStatus}>
											<SelectTrigger>
												<SelectValue placeholder="ステータスを選択（任意）" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="指示あり">指示あり</SelectItem>
												<SelectItem value="経過報告">経過報告</SelectItem>
												<SelectItem value="様子見中">様子見中</SelectItem>
												<SelectItem value="報告">完了報告</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="message">メッセージ</Label>
									<Textarea
										id="message"
										placeholder="対応状況や指示、質問などを入力してください"
										value={newMessage}
										onChange={(e) => setNewMessage(e.target.value)}
										required
										className="min-h-[80px] resize-none"
									/>
								</div>

								<div className="flex justify-end">
									<Button
										type="submit"
										disabled={
											isSubmitting ||
											!newMessage.trim() ||
											!responderName.trim()
										}
										className="bg-primary text-primary-foreground hover:bg-primary/90"
									>
										{isSubmitting ? (
											"送信中..."
										) : (
											<>
												<Send className="h-4 w-4 mr-2" />
												メッセージを送信
											</>
										)}
									</Button>
								</div>
							</form>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
