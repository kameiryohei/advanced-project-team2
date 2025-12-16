"use client";

import L from "leaflet";
import React, { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Leafletのデフォルトアイコンを修正
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
	iconRetinaUrl:
		"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
	iconUrl:
		"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
	shadowUrl:
		"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationPoint {
	latitude: number;
	longitude: number;
	recordedAt: string;
}

interface LeafletMapProps {
	locations: LocationPoint[];
	address: string;
	className?: string;
}

// マップの境界を自動調整するコンポーネント
function MapBounds({ locations }: { locations: LocationPoint[] }) {
	const map = useMap();

	useEffect(() => {
		if (locations.length === 0) return;

		if (locations.length === 1) {
			// 単一点の場合は中心に設定
			map.setView([locations[0].latitude, locations[0].longitude], 16);
		} else {
			// 複数点の場合は全ての点を含むよう境界を調整
			const bounds = L.latLngBounds(
				locations.map((loc) => [loc.latitude, loc.longitude]),
			);
			map.fitBounds(bounds, { padding: [20, 20] });
		}
	}, [map, locations]);

	return null;
}

export function LeafletMap({
	locations,
	address,
	className = "w-full h-48 md:h-64",
}: LeafletMapProps) {
	// デフォルト位置（東京）
	const defaultCenter: [number, number] = [35.6812, 139.7671];
	const center: [number, number] =
		locations.length > 0
			? [locations[0].latitude, locations[0].longitude]
			: defaultCenter;

	console.log("🗺️ Leaflet地図を描画:", {
		locationCount: locations.length,
		locations: locations.map((loc, index) => ({
			index: index + 1,
			lat: loc.latitude.toFixed(8),
			lon: loc.longitude.toFixed(8),
			time: new Date(loc.recordedAt).toLocaleTimeString(),
		})),
	});

	return (
		<div className={`${className} rounded-lg overflow-hidden border`}>
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
				{locations.map((location, index) => {
					const isFirst = index === 0;
					const isLast = index === locations.length - 1;

					// マーカーの色を開始点、終了点、中間点で区別
					const iconColor = isFirst ? "green" : isLast ? "red" : "blue";

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
									{address && <p className="text-xs mt-1">{address}</p>}
								</div>
							</Popup>
						</Marker>
					);
				})}

				{/* 境界を自動調整 */}
				<MapBounds locations={locations} />
			</MapContainer>

			{/* 地図上の情報表示 */}
			<div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium border z-[1000]">
				📍 {address}
				{locations.length > 1 && (
					<span className="ml-2 text-blue-600">
						({locations.length}地点の移動経路)
					</span>
				)}
			</div>
		</div>
	);
}
