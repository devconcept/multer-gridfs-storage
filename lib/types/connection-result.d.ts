import { Db, MongoClient } from 'mongodb';
export interface ConnectionResult {
    db: Db;
    client?: MongoClient;
}
