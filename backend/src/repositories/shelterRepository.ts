import type { Database } from "../db/database";

type ShelterCountRow = {
	shelterCount: number;
};

export type ShelterPostSummary = {
	id: string;
	author_name: string;
	content: string | null;
	posted_at: string;
	shelter_name: string;
	comment_count: number;
};

export type ShelterDetails = {
	id: number;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	created_at: string;
};



const recentPostsByShelterQuery = `SELECT
	p.id,
	p.author_name,
	p.content,
	p.posted_at,
	s.name AS shelter_name,
	COUNT(c.id) AS comment_count
FROM posts AS p
INNER JOIN shelters AS s ON p.shelter_id = s.id
LEFT JOIN comments AS c ON c.post_id = p.id
WHERE p.shelter_id = ?
GROUP BY
	p.id,
	p.author_name,
	p.content,
	p.posted_at,
	s.name
ORDER BY p.posted_at DESC
LIMIT 5`;

export const countShelters = async (db: Database): Promise<number> => {
	const { results } = await db
		.prepare("SELECT COUNT(*) AS shelterCount FROM shelters")
		.all<ShelterCountRow>();

	return results[0]?.shelterCount ?? 0;
};

export const fetchShelterDetails = async (db: Database, shelterId: number): Promise<ShelterDetails> => {
	const { results } = await db
		.prepare("SELECT * FROM shelters WHERE id = ?")
		.bind(shelterId)
		.all<ShelterDetails>();
	return results[0];
};

export const fetchRecentPostsByShelter = async (
	db: Database,
	shelterId: number,
): Promise<ShelterPostSummary[]> => {
	const { results } = await db
		.prepare(recentPostsByShelterQuery)
		.bind(shelterId)
		.all<ShelterPostSummary>();

	return results;
};
