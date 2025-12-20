"use client";

import L from "leaflet";
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
import { useEffect, useId, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type {
	CreateCommentRequest,
	PostDetailResponse,
} from "@/api/generated/model";
import {
	useGetPostsIdComments,
	usePostPostsIdComments,
} from "@/api/generated/team2API";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncService } from "@/lib/sync-service";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Leafletのデフォルトアイコンを修正
// biome-ignore lint/suspicious/noExplicitAny: Leaflet internal API requires this
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
	iconRetinaUrl:
		"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
	iconUrl:
		"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
	shadowUrl:
		"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// マップの境界を自動調整するコンポーネント
function MapBounds({
	locations,
}: {
	locations: Array<{ latitude: number; longitude: number }>;
}) {
	const map = useMap();

	useEffect(() => {
		if (locations.length === 0) return;

		if (locations.length === 1) {
			map.setView([locations[0].latitude, locations[0].longitude], 16);
		} else {
			const bounds = L.latLngBounds(
				locations.map((loc) => [loc.latitude, loc.longitude]),
			);
			map.fitBounds(bounds, { padding: [20, 20] });
		}
	}, [map, locations]);

	return null;
}

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
	status: "緊急" | "重要" | "通常" | null;
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
	onUpdateReportStatus: (reportId: string, status: Report["status"]) => void;
	postDetail?: PostDetailResponse;
	isLoadingPostDetail?: boolean;
}

// 地図コンポーネント - Leafletを使用して複数ピンを表示
function ReportLocationMap({
	report,
	postDetail,
}: {
	report: Report;
	postDetail?: PostDetailResponse;
}) {
	// すべての利用可能な位置情報を収集
	const allLocations: Array<{
		latitude: number;
		longitude: number;
		recordedAt: string;
	}> = [];

	// 投稿詳細の移動経路がある場合は全て追加
	if (postDetail?.locationTrack && postDetail.locationTrack.length > 0) {
		console.log("🗺️ LocationTrack データを処理中:", {
			totalPoints: postDetail.locationTrack.length,
			firstPoint: postDetail.locationTrack[0],
			lastPoint: postDetail.locationTrack[postDetail.locationTrack.length - 1],
		});

		// 最小限の重複チェック - 少しでも位置が違えば別の点として扱う
		for (const track of postDetail.locationTrack) {
			const isDuplicate = allLocations.some(
				(loc) =>
					Math.abs(loc.latitude - track.latitude) < 0.000001 &&
					Math.abs(loc.longitude - track.longitude) < 0.000001,
			);

			if (!isDuplicate) {
				allLocations.push(track);
			}
		}

		console.log("🗺️ LocationTrack処理完了:", {
			originalCount: postDetail.locationTrack.length,
			uniqueCount: allLocations.length,
		});
	}

	// reportオブジェクトに座標がある場合も追加（重複チェック付き）
	if (report.latitude && report.longitude) {
		const reportLocation = {
			latitude: report.latitude,
			longitude: report.longitude,
			recordedAt: new Date().toISOString(),
		};

		const isDuplicate = allLocations.some(
			(loc) =>
				Math.abs(loc.latitude - reportLocation.latitude) < 0.000001 &&
				Math.abs(loc.longitude - reportLocation.longitude) < 0.000001,
		);

		if (!isDuplicate) {
			allLocations.push(reportLocation);
		}
	}

	console.log("🗺️ Leaflet地図で表示する位置情報:", {
		totalLocations: allLocations.length,
		locations: allLocations.map((loc, index) => ({
			index: index + 1,
			lat: loc.latitude.toFixed(8),
			lon: loc.longitude.toFixed(8),
			time: loc.recordedAt,
		})),
	});

	const defaultCenter: [number, number] = [35.6812, 139.7671];
	const center: [number, number] =
		allLocations.length > 0
			? [allLocations[0].latitude, allLocations[0].longitude]
			: defaultCenter;

	// Leaflet地図を直接使用（トップ画面と同じ方式）
	return (
		<div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden border">
			<MapContainer
				center={center}
				zoom={13}
				className="w-full h-full"
				style={{ minHeight: "192px" }}
			>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>

				{/* 全ての位置にマーカーを配置 */}
				{allLocations.map((location, index) => {
					const isFirst = index === 0;
					const isLast = index === allLocations.length - 1;

					return (
						<Marker
							key={`${location.latitude}-${location.longitude}-${index}`}
							position={[location.latitude, location.longitude]}
						>
							<Popup>
								<div className="text-sm">
									<p className="font-semibold">
										{isFirst
											? "🟢 開始地点"
											: isLast
												? "🔴 終了地点"
												: `🔵 中間地点 ${index}`}
									</p>
									<p className="text-xs text-gray-600 mt-1">
										{new Date(location.recordedAt).toLocaleString()}
									</p>
									<p className="text-xs text-gray-500">
										{location.latitude.toFixed(6)},{" "}
										{location.longitude.toFixed(6)}
									</p>
									{/* <p className="text-xs mt-1">{report.address}</p> */}
								</div>
							</Popup>
						</Marker>
					);
				})}

				{/* 境界を自動調整 */}
				<MapBounds locations={allLocations} />
			</MapContainer>

			{/* 地図上の情報表示 */}
			<div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium border z-[1000]">
				<MapPin className="inline h-3 w-3 mr-1" />
				{allLocations.length > 1
					? `${report.address} (${allLocations.length}地点の移動経路)`
					: report.address}
			</div>
		</div>
	);
}

const getStatusColor = (status: string | null | undefined) => {
	switch (status) {
		case "緊急":
			return "bg-destructive text-destructive-foreground"; // 赤色（緊急）
		case "重要":
			return "bg-secondary text-secondary-foreground"; // オレンジ色（重要）
		case "通常":
			return "bg-chart-1 text-white"; // 緑色（通常）
		// コメントステータス
		case "未対応":
			return "bg-destructive text-destructive-foreground"; // 赤色（未対応）
		case "対応中":
			return "bg-secondary text-secondary-foreground"; // オレンジ色（対応中）
		case "対応済み":
		case "解決済み":
			return "bg-chart-1 text-white"; // 緑色（対応済み/解決済み）
		// 古い形式との互換性のため残す
		case "reported":
		case "通報":
			return "bg-destructive text-destructive-foreground";
		case "progress":
		case "経過報告":
			return "bg-secondary text-secondary-foreground";
		case "completed":
		case "完了報告":
			return "bg-chart-1 text-white";
		default:
			return "bg-muted text-muted-foreground";
	}
};

export function ConversationThread({
	report,
	messages,
	onBack,
	onUpdateReportStatus,
	postDetail,
	isLoadingPostDetail,
}: ConversationThreadProps) {
	const [newMessage, setNewMessage] = useState("");
	const [newStatus, setNewStatus] = useState("");
	const [responderName, setResponderName] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// APIクライアントの初期化
	const createCommentMutation = usePostPostsIdComments();

	// コメント一覧を取得
	const {
		data: commentsData,
		isLoading: isLoadingComments,
		refetch: refetchComments,
	} = useGetPostsIdComments(report.id);

	// Generate unique IDs for form elements
	const responderInputId = useId();
	const messageInputId = useId();

	// コメント一覧の末尾への参照を作成
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// 投稿詳細の位置情報をコンソールに出力
	useEffect(() => {
		if (postDetail) {
			console.log("📍 投稿詳細が読み込まれました:", {
				postId: postDetail.id,
				shelterName: postDetail.shelterName,
				locationTrack: postDetail.locationTrack,
				locationTrackLength: postDetail.locationTrack?.length || 0,
			});

			if (postDetail.locationTrack && postDetail.locationTrack.length > 0) {
				console.log(
					"🎯 投稿の全位置履歴:",
					postDetail.locationTrack.map((point, index) => ({
						index,
						latitude: point.latitude,
						longitude: point.longitude,
						recordedAt: point.recordedAt,
					})),
				);
			} else {
				console.log("⚠️ この投稿には位置情報が含まれていません");
			}
		}
	}, [postDetail]);

	const handleSubmitMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newMessage.trim() || !responderName.trim()) return;

		setIsSubmitting(true);

		// APIリクエスト用データを事前に組み立てる（catchでも参照するため）
		const commentData: CreateCommentRequest = {
			authorName: responderName,
			content: newMessage,
			...(newStatus && { status: newStatus as CreateCommentRequest["status"] }),
		};

		try {
			// APIリクエスト用のデータを作成
			// APIを呼び出してコメントを作成
			const result = await createCommentMutation.mutateAsync({
				id: report.id,
				data: commentData,
			});

			console.log("コメントが正常に作成されました:", result);

			// コメント一覧を再取得
			await refetchComments();

			// Update report status if new status is provided
			if (newStatus && newStatus !== report.status) {
				const statusMap: { [key: string]: Report["status"] } = {
					緊急: "緊急",
					重要: "重要",
					通常: "通常",
				};
				if (statusMap[newStatus]) {
					onUpdateReportStatus(report.id, statusMap[newStatus]);
				}
			}

			setNewMessage("");
			setNewStatus("");
			setIsSubmitting(false);

			// 最新のコメントまでスクロール
			setTimeout(() => {
				messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
			}, 100);
		} catch (error) {
			console.error("コメントの作成に失敗しました:", error);
			if (!navigator.onLine) {
				syncService.queueApiRequest({
					method: "POST",
					url: `/posts/${report.id}/comments`,
					data: commentData,
				});
				alert("オフラインのためコメントを同期待ちに登録しました。オンライン復帰後に送信します。");
			} else {
				alert("コメントの投稿に失敗しました。もう一度お試しください。");
			}
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
			{/* Header with Report Summary */}
			<Card>
				<CardHeader>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
						<div className="flex flex-col sm:flex-row sm:items-center gap-3">
							<Button variant="outline" size="sm" onClick={onBack}>
								<ArrowLeft className="h-4 w-4 mr-2" />
								一覧に戻る
							</Button>
							<div>
								<CardTitle className="text-lg sm:text-xl">
									報告詳細 - #{report.id}
								</CardTitle>
								<p className="text-xs sm:text-sm text-muted-foreground mt-1">
									{report.datetime} | {report.address}
								</p>
							</div>
						</div>
						<Badge className={getStatusColor(report.status)}>
							{report.status || "-"}
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

						<div>
							<h4 className="font-medium text-sm text-muted-foreground mb-2">
								報告場所
							</h4>
							<ReportLocationMap report={report} postDetail={postDetail} />
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

						{/* APIから取得したメディアの表示 */}
						{isLoadingPostDetail && (
							<div>
								<h4 className="font-medium text-sm text-muted-foreground mb-2">
									添付メディア
								</h4>
								<div className="border rounded-lg p-8 bg-muted/50 text-center">
									<p className="text-muted-foreground animate-pulse">
										メディアを読み込み中...
									</p>
								</div>
							</div>
						)}

						{postDetail?.media && postDetail.media.length > 0 && (
							<div>
								<h4 className="font-medium text-sm text-muted-foreground mb-2">
									添付メディア ({postDetail.media.length}件)
								</h4>
								<div className="space-y-4">
									{postDetail.media.map((media) => (
										<div
											key={media.mediaId}
											className="border rounded-lg overflow-hidden bg-muted/50"
										>
											{media.mediaType.startsWith("video/") ? (
												<>
													<video
														controls
														className="w-full max-h-[400px] md:max-h-[680px] object-cover"
														aria-label="報告に添付された動画"
													>
														<source src={media.url} type={media.mediaType} />
														<track
															kind="captions"
															src=""
															srcLang="ja"
															label="日本語"
														/>
														お使いのブラウザは動画再生に対応していません。
													</video>
													<div className="p-3 bg-background border-t text-sm text-muted-foreground">
														📹 {media.fileName || "動画ファイル"}
													</div>
												</>
											) : media.mediaType.startsWith("image/") ? (
												<>
													<img
														src={media.url}
														alt={media.fileName || "添付画像"}
														className="w-full max-h-[300px] md:max-h-[480px] object-contain"
													/>
													<div className="p-3 bg-background border-t text-sm text-muted-foreground">
														🖼️ {media.fileName || "画像ファイル"}
													</div>
												</>
											) : (
												<div className="p-3 text-sm text-muted-foreground">
													📄 {media.fileName || "ファイル"} ({media.mediaType})
												</div>
											)}
										</div>
									))}
								</div>
							</div>
						)}

						{/* 既存の添付動画の表示（フォールバック用） */}
						{!postDetail?.media?.length &&
							report.attachment?.includes("video") && (
								<div>
									<h4 className="font-medium text-sm text-muted-foreground mb-2">
										添付動画
									</h4>
									<div className="border rounded-lg overflow-hidden bg-muted/50">
										<video
											controls
											className="w-full max-h-64 md:max-h-80 object-cover"
											aria-label="報告に添付された動画"
										>
											<source
												src={`/api/attachments/${report.id}`}
												type="video/webm"
											/>
											<source
												src={`/api/attachments/${report.id}`}
												type="video/mp4"
											/>
											<track
												kind="captions"
												src=""
												srcLang="ja"
												label="日本語"
											/>
											お使いのブラウザは動画再生に対応していません。
										</video>
										<div className="p-3 bg-background border-t text-sm text-muted-foreground">
											📹 {report.attachment}
										</div>
									</div>
								</div>
							)}
					</div>
				</CardContent>
			</Card>

			{/* <Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MapPin className="h-5 w-5" />
						報告場所
					</CardTitle>
				</CardHeader>
				<CardContent>
					<ReportLocationMap report={report} />
				</CardContent>
			</Card> */}

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
							{isLoadingComments ? (
								<div className="text-center py-8 text-muted-foreground">
									<MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50 animate-pulse" />
									<p>コメントを読み込み中...</p>
								</div>
							) : (commentsData?.comments || messages).length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
									<p>まだやり取りがありません</p>
									<p className="text-sm">最初のメッセージを送信してください</p>
								</div>
							) : (
								// APIから取得したコメント、またはフォールバックで既存のmessagesを表示
								[
									...(commentsData?.comments || []).map((comment) => (
										<div key={comment.id} className="flex gap-3 justify-start">
											<div className="order-2 max-w-[70%]">
												<div className="rounded-lg p-3 bg-card border">
													<div className="flex items-center gap-2 mb-1">
														<User className="h-4 w-4" />
														<span className="text-xs text-muted-foreground">
															対応者:
														</span>
														<span className="font-medium text-sm">
															{comment.authorName}
														</span>
														{comment.status && (
															<Badge
																className={`text-xs ${getStatusColor(comment.status)}`}
															>
																{comment.status}
															</Badge>
														)}
													</div>
													<p className="text-sm">{comment.content}</p>
													<span className="text-xs text-muted-foreground mt-2 block">
														<Clock className="inline h-3 w-3 mr-1" />
														{new Date(comment.createdAt).toLocaleString(
															"ja-JP",
														)}
													</span>
												</div>
											</div>
										</div>
									)),
									// 既存のmessagesもフォールバックとして表示
									...messages.map((message) => (
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
									)),
								]
							)}
							{/* スクロール用の参照要素 */}
							<div ref={messagesEndRef} />
						</div>

						{/* New Message Form */}
						<div className="border-t pt-4">
							<form onSubmit={handleSubmitMessage} className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor={responderInputId}>対応者名</Label>
										<Input
											id={responderInputId}
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
												<SelectValue placeholder="ステータスを選択(任意)" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="未対応">未対応</SelectItem>
												<SelectItem value="対応中">対応中</SelectItem>
												<SelectItem value="対応済み">対応済み</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor={messageInputId}>メッセージ</Label>
									<Textarea
										id={messageInputId}
										placeholder="対応状況や指示、質問などを入力してください"
										value={newMessage}
										onChange={(e) => setNewMessage(e.target.value)}
										required
										className="min-h-20 resize-none"
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
