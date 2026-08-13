export interface NodeCallback<T = any, E = any> {
	(error: E, result?: undefined): void;
	(error: null | undefined, result: T): void;
}
