export interface NodeCallback<T = any, E = any> {
	(err: E, result?: undefined | null): void;
	(err: undefined | null, result: T): void;
}
