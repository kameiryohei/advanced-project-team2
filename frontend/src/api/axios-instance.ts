import Axios, { type AxiosError, type AxiosRequestConfig } from "axios";

export const AXIOS_INSTANCE = Axios.create({
	baseURL: "http://localhost:8787",
	headers: {
		"Content-Type": "application/json",
	},
});

// リクエスト/レスポンスインターセプター
AXIOS_INSTANCE.interceptors.request.use(
	(config) => {
		console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

AXIOS_INSTANCE.interceptors.response.use(
	(response) => {
		console.log(`API Response: ${response.status} ${response.config.url}`);
		return response;
	},
	(error: AxiosError) => {
		console.error(
			`API Error: ${error.response?.status} ${error.config?.url}`,
			error.response?.data,
		);
		return Promise.reject(error);
	},
);

export const axiosInstance = <T>(
	config: AxiosRequestConfig,
	options?: AxiosRequestConfig,
): Promise<T> => {
	const source = Axios.CancelToken.source();
	const promise = AXIOS_INSTANCE({
		...config,
		...options,
		cancelToken: source.token,
	}).then(({ data }) => data);

	// @ts-expect-error
	promise.cancel = () => {
		source.cancel("Query was cancelled");
	};

	return promise;
};

export type ErrorType<Error = AxiosError> = Error;
