export class EmptyVideoBodyError extends Error {
	constructor() {
		super("Request body is empty");
		this.name = "EmptyVideoBodyError";
	}
}

export class VideoNotFoundError extends Error {
	constructor(key: string) {
		super(`Object not found for key ${key}`);
		this.name = "VideoNotFoundError";
	}
}

type UploadVideoParams = {
	bucket: R2Bucket;
	key: string;
	body: ArrayBuffer;
	contentType: string;
};

type UploadVideoResult = {
	key: string;
	storedBytes: number;
	contentType: string;
};

type GetVideoParams = {
	bucket: R2Bucket;
	key: string;
};

type GetVideoResult = {
	body: ArrayBuffer;
	headers: Headers;
};

export const uploadVideo = async ({
	bucket,
	key,
	body,
	contentType,
}: UploadVideoParams): Promise<UploadVideoResult> => {
	if (body.byteLength === 0) {
		throw new EmptyVideoBodyError();
	}

	await bucket.put(key, body, { httpMetadata: { contentType } });

	return {
		key,
		storedBytes: body.byteLength,
		contentType,
	};
};

export const getVideo = async ({
	bucket,
	key,
}: GetVideoParams): Promise<GetVideoResult> => {
	const object = await bucket.get(key);

	if (!object) {
		throw new VideoNotFoundError(key);
	}

	const body = await object.arrayBuffer();
	const headers = new Headers();

	object.writeHttpMetadata(headers);
	headers.set(
		"Content-Type",
		object.httpMetadata?.contentType ?? "application/octet-stream",
	);
	headers.set("Content-Length", object.size.toString());

	return { body, headers };
};
