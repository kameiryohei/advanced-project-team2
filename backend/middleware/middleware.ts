import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

const isDevelopment = process.env.NODE_ENV === "local";
const isProduction = process.env.NODE_ENV === "production";

type MiddlewareOptions = {
	additionalOrigins?: string[];
};

export const createMiddleware = ({
	additionalOrigins = [],
}: MiddlewareOptions = {}): MiddlewareHandler => {
	const dynamicOriginSet = new Set(additionalOrigins.filter(Boolean));

	return cors({
		origin(origin) {
			// ---- Development ----
			if (isDevelopment) {
				return origin ?? "*";
			}

			// ---- Production ----
			if (isProduction) {
				if (!origin) return null;

				if (dynamicOriginSet.has(origin)) {
					return origin;
				}

				return null;
			}
			return null;
		},
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		maxAge: 86400,
		credentials: true,
	});
};
