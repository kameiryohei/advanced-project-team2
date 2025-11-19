import type { components } from "../../schema/schema";

const BASE_URL = "https://map.yahooapis.jp/geoapi/V1/reverseGeoCoder";

export async function reverseGeocoderFetch(
	lat: string,
	lon: string,
	apiKey: string,
): Promise<components["schemas"]["ReverseGeocoderResponse"]> {
	const params = new URLSearchParams({
		lat,
		lon,
		appid: apiKey,
		output: "json",
	});
	const response = await fetch(`${BASE_URL}?${params}`);

	if (!response.ok) {
		throw new Error("Yahoo APIからのレスポンスが失敗しました");
	}

	const data = (await response.json()) as Record<string, unknown>;
	const featureEntry = data.Feature;
	const features = Array.isArray(featureEntry)
		? (featureEntry as components["schemas"]["ReverseGeocoderFeature"][])
		: [];
	return { Feature: features };
}
