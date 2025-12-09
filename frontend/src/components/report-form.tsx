"use client";

import {
	AlertTriangle,
	Calendar,
	MapPin,
	Navigation,
	Square,
	Trash2,
	Upload,
	User,
	Video,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PostPostsBody, CreatePostRequest } from "@/api/generated/model";
import { getApiGeocodeReverse, usePostPosts } from "@/api/generated/team2API";
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

// 緊急度の型定義
type Priority = "緊急" | "重要" | "通常";

interface ReportData {
	id: string;
	datetime: string;
	address: string;
	details: string;
	status: "unassigned" | "in-progress" | "resolved";
	reporter: string;
	attachment?: string;
	responder: string;
	location?: {
		latitude: number;
		longitude: number;
	} | null;
}

interface ReportFormProps {
	shelterId: number;
	onClose: () => void;
	onSubmit: (report: ReportData) => void;
}

export function ReportForm({ shelterId, onClose, onSubmit }: ReportFormProps) {
	// APIクライアントの初期化
	const createPostMutation = usePostPosts();
	// 日本時間（JST）でdatetime-localフィールドを初期化する関数
	const getJSTDatetimeString = () => {
		const now = new Date();
		// 日本時間（UTC+9）に変換
		const jstOffset = 9 * 60 * 60 * 1000; // 9時間をミリ秒で
		const jstDate = new Date(now.getTime() + jstOffset);
		return jstDate.toISOString().slice(0, 16);
	};

	const [formData, setFormData] = useState({
		datetime: getJSTDatetimeString(),
		address: "",
		details: "",
		status: "unassigned" as ReportData["status"],
		priority: "通常" as Priority,
		reporter: "",
		attachment: null as File | null,
		responder: "未対応",
	});

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showCamera, setShowCamera] = useState(false);
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [isRecording, setIsRecording] = useState(false);
	const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
		null,
	);

	// 位置情報関連の状態管理
	const [allowGps] = useState(true);
	const [coords, setCoords] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [gpsStatus, setGpsStatus] = useState("位置情報を取得中...");

	const [videoPreview, setVideoPreview] = useState<string | null>(null);
	const [recordingDuration, setRecordingDuration] = useState(0);
	const videoRef = useRef<HTMLVideoElement>(null);
	const recordingIntervalRef = useRef<number | null>(null);

	// Generate unique IDs for form elements
	const datetimeId = useId();
	const addressId = useId();
	const detailsId = useId();
	const reporterId = useId();
	const attachmentId = useId();
	const priorityId = useId();

	// バックエンドAPI経由での逆ジオコーディング関数
	const reverseGeocode = useCallback(
		async (latitude: number, longitude: number): Promise<string | null> => {
			try {
				console.log(
					`逆ジオコーディング開始: lat=${latitude}, lon=${longitude}`,
				);

				const data = await getApiGeocodeReverse({
					lat: latitude,
					lon: longitude,
				});

				console.log("逆ジオコーディング結果:", data);

				// Yahoo APIのレスポンス構造に合わせて住所を取得
				if (
					data.Feature &&
					data.Feature.length > 0 &&
					data.Feature[0].Property
				) {
					const address = data.Feature[0].Property.Address;
					console.log("取得した住所:", address);
					return address;
				}

				console.log("住所データが見つかりませんでした");
				return null;
			} catch (error) {
				console.error("逆ジオコーディングエラー:", error);
				return null;
			}
		},
		[],
	);

	// 位置情報取得処理
	const handleGetLocation = useCallback(() => {
		setGpsStatus("位置情報を取得中...");

		if (!navigator.geolocation) {
			setGpsStatus("お使いのブラウザは位置情報に対応していません");
			return;
		}

		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const { latitude, longitude } = position.coords;
				setCoords({ latitude, longitude });
				setGpsStatus(
					`緯度: ${latitude.toFixed(6)}, 経度: ${longitude.toFixed(6)}`,
				);

				// 住所を取得してフォームに自動入力
				setGpsStatus("住所を取得中...");
				const address = await reverseGeocode(latitude, longitude);

				if (address) {
					setFormData((prev) => ({ ...prev, address }));
					setGpsStatus(
						`住所: ${address}\n緯度: ${latitude.toFixed(6)}, 経度: ${longitude.toFixed(6)}`,
					);
				} else {
					setGpsStatus(
						`住所の取得に失敗しました\n緯度: ${latitude.toFixed(6)}, 経度: ${longitude.toFixed(6)}`,
					);
				}

			},
			(error) => {
				console.error("位置情報取得エラー:", error);
				setGpsStatus("位置情報の取得に失敗しました");
			},
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 0,
			},
		);
	}, [reverseGeocode]);

	// 位置情報のクリア処理
	const handleClearLocation = () => {
		setCoords(null);
		setGpsStatus("");
		// 住所フィールドもクリア
		setFormData((prev) => ({ ...prev, address: "" }));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			// APIリクエスト用のメタデータを作成
			const metadata: CreatePostRequest = {
				shelterId: shelterId,
				authorName: formData.reporter,
				content: `${formData.details}\n\n発生場所: ${formData.address}`,
				occurredAt: new Date(formData.datetime).toISOString(),
				status: formData.priority,
				locationTrack: coords
					? [
							{
								recordedAt: new Date().toISOString(),
								latitude: coords.latitude,
								longitude: coords.longitude,
							},
						]
					: [],
				media: formData.attachment
					? [
							{
								mediaType: formData.attachment.type,
								fileName: formData.attachment.name,
							},
						]
					: [],
			};

			// PostPostsBody型でリクエストを構築
			const postData: PostPostsBody = {
				metadata: metadata,
				mediaFiles: formData.attachment ? [formData.attachment] : undefined,
			};

			// APIを呼び出して投稿を作成
			const result = await createPostMutation.mutateAsync({
				data: postData,
			});

			console.log("投稿が正常に作成されました:", result);

			// 従来のコールバックも呼び出し（既存の機能との互換性）
			const reportData: ReportData = {
				id: Math.random().toString(),
				datetime: new Date(formData.datetime)
					.toLocaleString("ja-JP", {
						year: "numeric",
						month: "2-digit",
						day: "2-digit",
						hour: "2-digit",
						minute: "2-digit",
						timeZone: "Asia/Tokyo",
					})
					.replace(/\//g, "/")
					.replace(",", ""),
				address: formData.address,
				details: formData.details,
				status: formData.status,
				reporter: formData.reporter,
				attachment: formData.attachment ? formData.attachment.name : undefined,
				responder: formData.responder,
				location: coords,
			};

			onSubmit(reportData);

			// フォームをリセット
			handleClearLocation();
			setIsSubmitting(false);
			onClose();
		} catch (error) {
			console.error("投稿の作成に失敗しました:", error);
			alert("投稿の作成に失敗しました。もう一度お試しください。");
			setIsSubmitting(false);
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setFormData((prev) => ({ ...prev, attachment: file }));
		}
	};

	const startCamera = async () => {
		try {
			// カメラの制約を改善（フォールバック付き）
			const constraints = {
				video: {
					facingMode: "environment", // 背面カメラを優先
					width: { ideal: 1280, max: 1920 },
					height: { ideal: 720, max: 1080 },
					frameRate: { ideal: 30, max: 60 },
				},
				audio: true,
			};

			let mediaStream: MediaStream;
			try {
				// まず背面カメラを試す
				mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
			} catch (backError) {
				console.warn(
					"背面カメラが利用できません、前面カメラを試します:",
					backError,
				);
				// 背面カメラが失敗した場合、前面カメラを試す
				const frontConstraints = {
					video: {
						facingMode: "user",
						width: { ideal: 1280, max: 1920 },
						height: { ideal: 720, max: 1080 },
						frameRate: { ideal: 30, max: 60 },
					},
					audio: true,
				};
				try {
					mediaStream =
						await navigator.mediaDevices.getUserMedia(frontConstraints);
				} catch (frontError) {
					console.warn("前面カメラも失敗、基本設定で試します:", frontError);
					// 最終的なフォールバック
					mediaStream = await navigator.mediaDevices.getUserMedia({
						video: true,
						audio: true,
					});
				}
			}

			setShowCamera(true);
			setStream(mediaStream);

			// 少し待ってからvideo要素にストリームを設定
			setTimeout(async () => {
				if (videoRef.current && mediaStream) {
					videoRef.current.srcObject = mediaStream;
					// ビデオの読み込みを確実にする
					try {
						await videoRef.current.play();
						console.log("カメラプレビューが開始されました");
					} catch (playError) {
						console.warn("ビデオの自動再生に失敗:", playError);
						// ユーザーインタラクションが必要な場合がある
						videoRef.current.muted = true;
						try {
							await videoRef.current.play();
						} catch (secondTryError) {
							console.error("ビデオ再生に2度目も失敗:", secondTryError);
						}
					}
				}
			}, 100);
		} catch (error) {
			console.error("カメラの起動に失敗しました:", error);
			alert(
				"カメラにアクセスできませんでした。\n\n原因:\n1. カメラのアクセス許可が拒否されている\n2. 他のアプリケーションがカメラを使用中\n3. HTTPS接続が必要\n\nブラウザの設定を確認してください。",
			);
		}
	};

	const stopCamera = () => {
		if (mediaRecorder && isRecording) {
			mediaRecorder.stop();
		}
		if (stream) {
			for (const track of stream.getTracks()) {
				track.stop();
			}
			setStream(null);
		}

		// Clear recording timer
		if (recordingIntervalRef.current) {
			clearInterval(recordingIntervalRef.current);
			recordingIntervalRef.current = null;
		}

		setShowCamera(false);
		setIsRecording(false);
		setMediaRecorder(null);
		setRecordingDuration(0);
	};

	const resetAttachment = () => {
		setFormData((prev) => ({ ...prev, attachment: null }));
		if (videoPreview) {
			URL.revokeObjectURL(videoPreview);
			setVideoPreview(null);
		}
	};

	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	};

	const startRecording = () => {
		if (stream) {
			// Reset recording state
			setRecordingDuration(0);

			const recorder = new MediaRecorder(stream, {
				mimeType: "video/webm; codecs=vp8,opus",
			});

			const chunks: Blob[] = [];
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					chunks.push(event.data);
				}
			};

			recorder.onstop = () => {
				const blob = new Blob(chunks, { type: "video/webm" });
				const videoUrl = URL.createObjectURL(blob);
				setVideoPreview(videoUrl);

				const file = new File([blob], `video_${Date.now()}.webm`, {
					type: "video/webm",
				});
				setFormData((prev) => ({ ...prev, attachment: file }));

				// Clear recording timer
				if (recordingIntervalRef.current) {
					clearInterval(recordingIntervalRef.current);
					recordingIntervalRef.current = null;
				}
				stopCamera();
			};

			setMediaRecorder(recorder);
			recorder.start();
			setIsRecording(true);

			// Start recording duration timer
			recordingIntervalRef.current = setInterval(() => {
				setRecordingDuration((prev) => prev + 1);
			}, 1000);
		}
	};

	const stopRecording = () => {
		if (mediaRecorder && isRecording) {
			mediaRecorder.stop();
			setIsRecording(false);
		}
	};

	// コンポーネントマウント時に自動的に位置情報を取得
	useEffect(() => {
		handleGetLocation();
	}, [handleGetLocation]);

	useEffect(() => {
		return () => {
			if (stream) {
				for (const track of stream.getTracks()) {
					track.stop();
				}
			}
			if (recordingIntervalRef.current) {
				clearInterval(recordingIntervalRef.current);
			}
			if (videoPreview) {
				URL.revokeObjectURL(videoPreview);
			}
		};
	}, [stream, videoPreview]);

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-10000">
			<Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10001">
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
							<Label htmlFor={datetimeId} className="flex items-center gap-2">
								<Calendar className="h-4 w-4" />
								発生日時
							</Label>
							<Input
								id={datetimeId}
								type="datetime-local"
								value={formData.datetime}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, datetime: e.target.value }))
								}
								required
								className="w-full"
							/>
						</div>

						{/* Address */}
						<div className="space-y-2">
							<Label htmlFor={addressId} className="flex items-center gap-2">
								<MapPin className="h-4 w-4" />
								発生場所・住所
							</Label>
							<Input
								id={addressId}
								type="text"
								placeholder="例: 愛知県名古屋市中区栄1-1-1"
								value={formData.address}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, address: e.target.value }))
								}
								required
								className="w-full"
							/>
						</div>

						{/* Location Section */}
						{allowGps && (
							<div className="space-y-2">
								<Label className="flex items-center gap-2">
									<Navigation className="h-4 w-4" />
									位置情報
								</Label>
								<div className="space-y-3">
									{coords ? (
										<div className="border rounded-lg p-4 bg-muted/50 space-y-2">
											<div className="flex items-center justify-between">
												<div className="text-sm">
													<p className="font-medium">
														現在位置が取得されました
													</p>
													<p className="text-muted-foreground">{gpsStatus}</p>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={handleClearLocation}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									) : (
										<div className="space-y-2">
											<Button
												type="button"
												variant="outline"
												onClick={handleGetLocation}
												className="w-full"
											>
												<MapPin className="h-4 w-4 mr-2" />
												位置情報を再取得
											</Button>
											{gpsStatus && (
												<p className="text-sm text-muted-foreground">
													{gpsStatus}
												</p>
											)}
										</div>
									)}
								</div>
							</div>
						)}

						{/* Details */}
						<div className="space-y-2">
							<Label htmlFor={detailsId}>詳細情報</Label>
							<Textarea
								id={detailsId}
								placeholder="被害の詳細、状況、必要な支援内容などを具体的に記入してください"
								value={formData.details}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, details: e.target.value }))
								}
								required
								className="min-h-[100px] resize-none"
							/>
						</div>

						{/* Reporter */}
						<div className="space-y-2">
							<Label htmlFor={reporterId} className="flex items-center gap-2">
								<User className="h-4 w-4" />
								報告者名
							</Label>
							<Input
								id={reporterId}
								type="text"
								placeholder="お名前を入力してください"
								value={formData.reporter}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, reporter: e.target.value }))
								}
								required
								className="w-full"
							/>
						</div>

						{/* Priority/Status */}
						<div className="space-y-2">
							<Label htmlFor={priorityId}>緊急度</Label>
							<Select
								value={formData.priority}
								onValueChange={(value: Priority) =>
									setFormData((prev) => ({ ...prev, priority: value }))
								}
							>
								<SelectTrigger id={priorityId}>
									<SelectValue placeholder="緊急度を選択" />
								</SelectTrigger>
								<SelectContent className="z-10002">
									<SelectItem value="緊急">
										<div className="flex items-center gap-2">
											<div className="w-2 h-2 rounded-full bg-destructive"></div>
											緊急 - 即座に対応が必要
										</div>
									</SelectItem>
									<SelectItem value="重要">
										<div className="flex items-center gap-2">
											<div className="w-2 h-2 rounded-full bg-secondary"></div>
											重要 - 早急な対応が必要
										</div>
									</SelectItem>
									<SelectItem value="通常">
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
							<Label htmlFor={attachmentId} className="flex items-center gap-2">
								<Upload className="h-4 w-4" />
								添付ファイル（写真・動画など）
							</Label>{" "}
							{!showCamera ? (
								<div className="space-y-3">
									{/* 添付ファイルプレビュー */}
									{formData.attachment && (
										<div className="border rounded-lg p-4 bg-muted/50">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Video className="h-4 w-4" />
													<span className="text-sm font-medium">
														{formData.attachment.name}
													</span>
													<span className="text-xs text-muted-foreground">
														(
														{(formData.attachment.size / 1024 / 1024).toFixed(
															2,
														)}{" "}
														MB)
													</span>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={resetAttachment}
												>
													<X className="h-4 w-4" />
												</Button>
											</div>
											{videoPreview && (
												<video
													src={videoPreview}
													controls
													className="mt-3 w-full h-40 object-cover rounded"
													aria-label="録画した動画のプレビュー"
												>
													<track
														kind="captions"
														src=""
														srcLang="ja"
														label="日本語"
													/>
												</video>
											)}
										</div>
									)}

									{/* ファイル選択エリア */}
									{!formData.attachment && (
										<div className="border-2 border-dashed border-border rounded-lg p-4">
											<input
												id={attachmentId}
												type="file"
												accept="image/*,video/*"
												onChange={handleFileChange}
												className="hidden"
											/>
											<label
												htmlFor={attachmentId}
												className="flex flex-col items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
											>
												<Upload className="h-8 w-8" />
												<span className="text-sm">
													ファイルを選択またはドラッグ&ドロップ
												</span>
												<span className="text-xs">画像・動画ファイル対応</span>
											</label>
										</div>
									)}

									{/* カメラ起動ボタン */}
									<div className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={startCamera}
											className="flex-1"
										>
											<Video className="h-4 w-4 mr-2" />
											動画を録画
										</Button>
									</div>
								</div>
							) : (
								/* カメラプレビュー */
								<div className="space-y-3">
									<div className="relative border rounded-lg overflow-hidden bg-gray-900">
										{!stream ? (
											<div className="w-full h-64 flex items-center justify-center text-white">
												<div className="text-center">
													<Video className="h-8 w-8 mx-auto mb-2 animate-pulse" />
													<p className="text-sm">カメラを起動中...</p>
												</div>
											</div>
										) : (
											<video
												ref={videoRef}
												autoPlay
												playsInline
												muted
												controls={false}
												className="w-full h-64 object-cover"
												style={{ transform: "scaleX(-1)" }}
												onLoadedMetadata={(e) => {
													const video = e.target as HTMLVideoElement;
													console.log("ビデオメタデータが読み込まれました", {
														width: video.videoWidth,
														height: video.videoHeight,
													});
												}}
												onCanPlay={(e) => {
													const video = e.target as HTMLVideoElement;
													console.log(
														"ビデオの再生準備が完了しました",
														video.readyState,
													);
												}}
												onError={(e) => {
													console.error("ビデオエラー:", e);
												}}
												onPlay={() => {
													console.log("ビデオが再生開始されました");
												}}
											/>
										)}
										{/* ステータス表示 */}
										{stream && (
											<div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded text-xs">
												カメラアクティブ
											</div>
										)}
										{/* 録画インジケーターと時間表示 */}
										{isRecording && (
											<div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full">
												<div className="w-2 h-2 bg-white rounded-full animate-pulse" />
												<span className="text-sm font-medium">
													REC {formatDuration(recordingDuration)}
												</span>
											</div>
										)}{" "}
										{/* 動画録画コントロール */}
										<div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
											{!isRecording ? (
												<Button
													type="button"
													onClick={startRecording}
													className="bg-red-600 text-white hover:bg-red-700 rounded-full w-16 h-16 flex items-center justify-center"
												>
													<Video className="h-6 w-6" />
												</Button>
											) : (
												<Button
													type="button"
													onClick={stopRecording}
													className="bg-gray-800 text-white hover:bg-gray-700 rounded-full w-16 h-16 flex items-center justify-center"
												>
													<Square className="h-6 w-6" />
												</Button>
											)}
										</div>
										{/* 閉じるボタン */}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={stopCamera}
											className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
											disabled={isRecording}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>

									<div className="text-xs text-muted-foreground text-center space-y-1">
										{isRecording ? (
											<div>
												<p>録画中です ({formatDuration(recordingDuration)})</p>
												<p>停止ボタン（■）をタップして録画を終了してください</p>
											</div>
										) : (
											<div>
												<p>🔴 動画録画開始　✕ カメラ終了</p>
												<div className="mt-2 flex gap-2 justify-center">
													<button
														type="button"
														onClick={() => {
															console.log("Debug: Stream state:", !!stream);
															console.log(
																"Debug: VideoRef current:",
																!!videoRef.current,
															);
															if (videoRef.current) {
																console.log(
																	"Debug: Video srcObject:",
																	!!videoRef.current.srcObject,
																);
																console.log(
																	"Debug: Video readyState:",
																	videoRef.current.readyState,
																);
																console.log(
																	"Debug: Video paused:",
																	videoRef.current.paused,
																);
																console.log(
																	"Debug: Video muted:",
																	videoRef.current.muted,
																);
															}
															if (stream) {
																console.log(
																	"Debug: Stream tracks:",
																	stream.getTracks().map((t) => ({
																		kind: t.kind,
																		enabled: t.enabled,
																		readyState: t.readyState,
																	})),
																);
															}
														}}
														className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
													>
														デバッグ情報
													</button>
												</div>
											</div>
										)}
									</div>
								</div>
							)}
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
	);
}
