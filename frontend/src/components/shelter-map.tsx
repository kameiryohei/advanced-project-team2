"use client";
import { Icon } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Leafletのデフォルトアイコンの問題を修正
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Button } from "./ui/button";

interface Shelter {
	id: string;
	name: string;
	status: "online" | "offline";
	population: number;
	urgentReports: number;
	address: string;
	latitude: number;
	longitude: number;
}

interface ShelterMapProps {
	shelters: Shelter[];
	onShelterSelect: (shelterId: string) => void;
}

export function ShelterMap({ shelters, onShelterSelect }: ShelterMapProps) {
	useEffect(() => {
		// Leafletのデフォルトアイコンを設定
		delete (Icon.Default.prototype as any)._getIconUrl;
		Icon.Default.mergeOptions({
			iconRetinaUrl: markerRetina,
			iconUrl: markerIcon,
			shadowUrl: markerShadow,
		});
	}, []);

	// カスタムSVGアイコンを作成する関数
	const createCustomIcon = (color: string) => {
		const svgIcon = `
            <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.5 0C5.597 0 0 5.597 0 12.5c0 8.284 12.5 28.5 12.5 28.5s12.5-20.216 12.5-28.5C25 5.597 19.403 0 12.5 0z" fill="${color}" stroke="#ffffff" stroke-width="1"/>
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

	// オンライン避難所用のカスタムアイコン（緑色）
	const onlineIcon = createCustomIcon("#22c55e"); // 凡例の緑色と一致

	// オフライン避難所用のカスタムアイコン（赤色）
	const offlineIcon = createCustomIcon("#ef4444"); // 凡例の赤色と一致

	// // オンライン避難所用のカスタムアイコン
	// const onlineIcon = new Icon({
	// 	iconUrl: markerIcon,
	// 	shadowUrl: markerShadow,
	// 	iconSize: [25, 41],
	// 	iconAnchor: [12, 41],
	// 	popupAnchor: [1, -34],
	// 	className: "online-marker",
	// });

	// // オフライン避難所用のカスタムアイコン
	// const offlineIcon = new Icon({
	// 	iconUrl: markerIcon,
	// 	shadowUrl: markerShadow,
	// 	iconSize: [25, 41],
	// 	iconAnchor: [12, 41],
	// 	popupAnchor: [1, -34],
	// 	className: "offline-marker",
	// });

	// 地図の中心点を計算（全避難所の平均位置）
	const centerLat =
		shelters.reduce((sum, shelter) => sum + shelter.latitude, 0) /
		shelters.length;
	const centerLng =
		shelters.reduce((sum, shelter) => sum + shelter.longitude, 0) /
		shelters.length;

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
					{shelters.map((shelter) => (
						<Marker
							key={shelter.id}
							position={[shelter.latitude, shelter.longitude]}
							icon={shelter.status === "online" ? onlineIcon : offlineIcon}
							eventHandlers={{
								click: () => onShelterSelect(shelter.id),
							}}
						>
							<Popup>
								<div className="p-2">
									<h3 className="font-bold text-lg">{shelter.name}</h3>
									<p className="text-sm text-gray-600">{shelter.address}</p>
									<div className="mt-2 space-y-1">
										<p className="text-sm">
											<span className="font-medium">状態:</span>{" "}
											<span
												className={
													shelter.status === "online"
														? "text-green-600"
														: "text-red-600"
												}
											>
												{shelter.status === "online"
													? "オンライン"
													: "オフライン"}
											</span>
										</p>
										<p className="text-sm">
											<span className="font-medium">避難者数:</span>{" "}
											{shelter.population}人
										</p>
										{shelter.urgentReports > 0 && (
											<p className="text-sm text-red-600">
												<span className="font-medium">緊急報告:</span>{" "}
												{shelter.urgentReports}件
											</p>
										)}
									</div>
									<Button
										className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
										onClick={() => onShelterSelect(shelter.id)}
									>
										詳細表示
									</Button>
								</div>
							</Popup>
						</Marker>
					))}
				</MapContainer>
			</div>

			<style>
				{`
        .online-marker {
          filter: hue-rotate(120deg) saturate(1.5);
        }
        .offline-marker {
          filter: hue-rotate(0deg) saturate(2) brightness(0.8);
        }
      `}
			</style>
		</>
	);
}
