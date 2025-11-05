import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(() => {
	const isCI = process.env.CI === "true";
	const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5173;
	const server = isCI
		? undefined
		: {
				host: true,
				port: Number.isFinite(port) ? port : 5173,
			};

	return {
		plugins: [react()],
		...(server ? { server } : {}),
	};
});
