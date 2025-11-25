export type Bindings = {
	advanced_project_team2: D1Database;
	ASSET_BUCKET: R2Bucket;
	FRONTEND_ORIGIN?: string;
	YAHOO_MAPS_API_KEY: string;
	R2_BUCKET_NAME: string;
	CLOUDFLARE_R2_ACCOUNT_ID: string;
	R2_ACCESS_KEY_ID: string;
	R2_SECRET_ACCESS_KEY: string;
	NODE_ENV?: string;
};

export const dbConnect = (env: Bindings): D1Database =>
	env.advanced_project_team2;

export type Database = ReturnType<typeof dbConnect>;
