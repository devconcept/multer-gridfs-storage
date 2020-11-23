import {Connection, Mongoose} from 'mongoose';
import {Db} from 'mongodb';

export type DbTypes = Mongoose | Connection | Db;
