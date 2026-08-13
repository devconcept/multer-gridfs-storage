import { Db } from 'mongodb';
export interface CacheValue {
    db: Db | null;
    pending: boolean;
    opening: boolean;
    init: unknown;
}
