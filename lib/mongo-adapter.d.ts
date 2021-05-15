import { MongoClientOptions } from 'mongodb';
import { ConnectionResult } from './types';
export declare const openConnection: (url: string, options: MongoClientOptions) => Promise<ConnectionResult>;
