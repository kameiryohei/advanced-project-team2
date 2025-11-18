import type { Database } from "../db/database";

type ShelterCountRow = {
	shelterCount: number;
};

interface Shelter {
	id: number;
	name: string;
}

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

export type NewCommentResult = {
	id: string;
	postId: string;
	authorName: string;
	content: string;
	createdAt: string;
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

export const fetchShelterDetails = async (
	db: Database,
	shelterId: number,
): Promise<ShelterDetails> => {
	const { results } = await db
		.prepare("SELECT * FROM shelters WHERE id = ?")
		.bind(shelterId)
		.all<ShelterDetails>();
	return results[0];
};

export const getShelterList = async (db: Database): Promise<Shelter[]> => {
	const { results } = await db
		.prepare("SELECT id, name FROM shelters;")
		.all<Shelter>();
	return results ?? [];
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

export const createCommentForPost = async (
	db: Database,
	{
		commentId,
		postId,
		authorName,
		content,
	}: {
		commentId: string;
		postId: string;
		authorName: string;
		content: string;
	},
): Promise<NewCommentResult> => {
	const createdAt = new Date().toISOString();

	const result = await db
		.prepare(
			`
      INSERT INTO comments (id, post_id, author_name, content, created_at)
      VALUES (?, ?, ?, ?, ?)
      RETURNING
        id,
        post_id AS postId,
        author_name AS authorName,
        content,
        created_at AS createdAt
    `,
		)
		.bind(commentId, postId, authorName, content, createdAt)
		.first<NewCommentResult>();

	if (!result) {
		throw new Error("Insert failed");
	}

	return {
		...result,
		id: String(result.id),
		postId: String(result.postId),
	};
};
