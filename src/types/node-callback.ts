export interface NodeCallback<T = any, E = any> {
	(error: E, result?: undefined | undefined): void;
	(error: undefined | undefined, result: T): void;
}
