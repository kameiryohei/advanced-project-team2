import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

const DEFAULT_ALLOWED_ORIGINS = new Set<string>([
	"http://localhost:8080",
	"http://127.0.0.1:8080",
	"http://localhost:8081",
	"http://127.0.0.1:8081",
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"https://editor.swagger.io",
]);

const isDevelopment = process.env.NODE_ENV === "local";
const isProduction = process.env.NODE_ENV === "production";

const resolveCorsOrigin = (
	origin: string | null | undefined,
): string | null => {
	if (!origin) {
		return "*";
	}

	if (DEFAULT_ALLOWED_ORIGINS.has(origin)) {
		return origin;
	}

	try {
		const url = new URL(origin);
		if (url.protocol === "https:" && url.hostname.endsWith(".pages.dev")) {
			return origin;
		}
	} catch (_error) {}

	return null;
};

type MiddlewareOptions = {
	additionalOrigins?: string[];
};

export const createMiddleware = ({
	additionalOrigins = [],
}: MiddlewareOptions = {}): MiddlewareHandler => {
	const dynamicOrigins = additionalOrigins.filter((origin): origin is string =>
		Boolean(origin),
	);
	const dynamicOriginSet = new Set<string>(dynamicOrigins);

	return cors({
		origin(origin) {
			if (isDevelopment) {
				return origin ?? "*";
			}

			if (isProduction) {
				if (!origin) {
					return "*";
				}

				if (dynamicOriginSet.has(origin)) {
					return origin;
				}

				return null;
			}

			if (dynamicOriginSet.has(origin ?? "")) {
				return origin ?? "*";
			}

			return resolveCorsOrigin(origin);
		},
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		maxAge: 86400,
		credentials: true,
	});
};
