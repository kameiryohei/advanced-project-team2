import { defineConfig } from "orval";

export default defineConfig({
	api: {
		input: "../schema/openapi.yaml",
		output: {
			mode: "split",
			target: "src/api/generated",
			schemas: "src/api/generated/model",
			client: "react-query",
			override: {
				mutator: {
					path: "./src/api/axios-instance.ts",
					name: "axiosInstance",
				},
			},
		},
		hooks: {
			afterAllFilesWrite: "prettier --write",
		},
	},
});
