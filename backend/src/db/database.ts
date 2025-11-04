export type Bindings = {
	advanced_project_team2: D1Database;
};

export const dbConnect = (env: Bindings): D1Database => env.advanced_project_team2;

export type Database = ReturnType<typeof dbConnect>;
