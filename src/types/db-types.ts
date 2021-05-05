import {Db} from 'mongodb';

export interface MongooseConnectionInstance {
	db: Db;
}

export interface MongooseInstance {
	connection: MongooseConnectionInstance;
}

export type DbTypes = MongooseInstance | MongooseConnectionInstance | Db;
