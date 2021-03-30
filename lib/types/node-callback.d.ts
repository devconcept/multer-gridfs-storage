export interface NodeCallback<T = any, E = any> {
    (error: E, result?: undefined | null): void;
    (error: undefined | null, result: T): void;
}
