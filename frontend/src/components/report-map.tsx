"use client";
import { Icon } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

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

interface ReportMapProps {
	reports: Report[];
	onReportSelect: (reportId: string) => void;
}

export function ReportMap({ reports, onReportSelect }: ReportMapProps) {
	useEffect(() => {
		delete (Icon.Default.prototype as any)._getIconUrl;
		Icon.Default.mergeOptions({
			iconRetinaUrl: markerRetina,
			iconUrl: markerIcon,
			shadowUrl: markerShadow,
		});
	}, []);

	const createCustomIcon = (color: string) => {
		const svgIcon = `
      <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C5.597 0 0 5.597 0 12.5c0 8.284 12.5 28.5 12.5 28.5s12.5-20.216 12.5-28.5C25 5.597 19.403 0 12.5 0z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12.5" cy="12.5" r="4" fill="#ffffff"/>
      </svg>
    `;

		return new Icon({
			iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
			shadowUrl: markerShadow,
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
		});
	};

	const getIconByStatus = (status: string) => {
		switch (status) {
			case "unassigned":
				return createCustomIcon("#ef4444");
			case "in-progress":
				return createCustomIcon("#f59e0b");
			case "monitoring":
				return createCustomIcon("#3b82f6");
			case "resolved":
				return createCustomIcon("#10b981");
			default:
				return createCustomIcon("#6b7280");
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case "unassigned":
				return "未対応";
			case "in-progress":
				return "対応中";
			// case "monitoring":
			// 	return "監視中";
			case "resolved":
				return "解決済み";
			default:
				return "不明";
		}
	};

	const reportsWithLocation = reports.filter(
		(report) => report.latitude !== undefined && report.longitude !== undefined,
	);

	const centerLat =
		reportsWithLocation.length > 0
			? reportsWithLocation.reduce(
					(sum, report) => sum + (report.latitude || 0),
					0,
				) / reportsWithLocation.length
			: 35.6762;
	const centerLng =
		reportsWithLocation.length > 0
			? reportsWithLocation.reduce(
					(sum, report) => sum + (report.longitude || 0),
					0,
				) / reportsWithLocation.length
			: 139.6503;

	return (
		<>
			<div className="h-96 w-full rounded-lg overflow-hidden border">
				<MapContainer
					center={[centerLat, centerLng]}
					zoom={12}
					style={{ height: "100%", width: "100%" }}
				>
					<TileLayer
						attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					/>
					{reportsWithLocation.map((report) => (
						<Marker
							key={report.id}
							position={[report.latitude!, report.longitude!]}
							icon={getIconByStatus(report.status)}
							eventHandlers={{
								click: () => onReportSelect(report.id),
							}}
						>
							<Popup>
								<div className="p-2">
									<h3 className="font-bold text-lg">報告 #{report.id}</h3>
									<p className="text-sm text-gray-600">{report.address}</p>
									<div className="mt-2 space-y-1">
										<p className="text-sm">
											<span className="font-medium">詳細:</span>{" "}
											{report.details}
										</p>
										<p className="text-sm">
											<span className="font-medium">報告者:</span>{" "}
											{report.reporter}
										</p>
										<p className="text-sm">
											<span className="font-medium">状態:</span>{" "}
											<span
												className={
													report.status === "resolved"
														? "text-green-600"
														: report.status === "in-progress"
															? "text-orange-600"
															: report.status === "monitoring"
																? "text-blue-600"
																: "text-red-600"
												}
											>
												{getStatusLabel(report.status)}
											</span>
										</p>
										<p className="text-sm">
											<span className="font-medium">日時:</span>{" "}
											{report.datetime}
										</p>
									</div>
									<button
										className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
										onClick={() => onReportSelect(report.id)}
									>
										詳細表示
									</button>
								</div>
							</Popup>
						</Marker>
					))}
				</MapContainer>
			</div>
		</>
	);
}
