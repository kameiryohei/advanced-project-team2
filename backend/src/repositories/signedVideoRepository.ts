import { AwsClient } from "aws4fetch";

export class SignedVideoFetchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SignedVideoFetchError";
	}
}

export class SignedVideoUploadError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SignedVideoUploadError";
	}
}

export type SignedVideoFetchParams = {
	bucketName: string;
	accountId: string;
	objectKey: string;
	accessKeyId: string;
	secretAccessKey: string;
	expiresInSeconds?: number;
};

export type SignedVideoUploadParams = {
	bucketName: string;
	accountId: string;
	objectKey: string;
	accessKeyId: string;
	secretAccessKey: string;
	body: ArrayBuffer;
	contentType: string;
};

const DEFAULT_EXPIRATION_SECONDS = 3600;

export const fetchSignedVideo = async ({
	bucketName,
	accountId,
	objectKey,
	accessKeyId,
	secretAccessKey,
	expiresInSeconds = DEFAULT_EXPIRATION_SECONDS,
}: SignedVideoFetchParams): Promise<string> => {
	const url = new URL(
		`https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${objectKey}`,
	);
	url.searchParams.set("X-Amz-Expires", expiresInSeconds.toString());

	const client = new AwsClient({
		accessKeyId,
		secretAccessKey,
	});

	const signedRequest = await client.sign(
		new Request(url, {
			method: "GET",
		}),
		{
			aws: { signQuery: true },
		},
	);

	return signedRequest.url;
};

export const uploadSignedVideo = async ({
	bucketName,
	accountId,
	objectKey,
	accessKeyId,
	secretAccessKey,
	body,
	contentType,
}: SignedVideoUploadParams): Promise<void> => {
	const url = new URL(
		`https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${objectKey}`,
	);

	const client = new AwsClient({
		accessKeyId,
		secretAccessKey,
	});

	const signedRequest = await client.sign(
		new Request(url, {
			method: "PUT",
			body,
			headers: {
				"Content-Type": contentType,
			},
		}),
	);

	const response = await fetch(signedRequest);
	if (!response.ok) {
		const message = await response.text();
		throw new SignedVideoUploadError(
			`Upload failed: ${response.status} ${message}`,
		);
	}
};
