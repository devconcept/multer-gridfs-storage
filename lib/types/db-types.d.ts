import { Db } from 'mongodb';
export interface MongooseConnectionInstance {
    db: Db;
}
export interface MongooseInstance {
    connection: MongooseConnectionInstance;
}
export declare type DbTypes = MongooseInstance | MongooseConnectionInstance | Db;
