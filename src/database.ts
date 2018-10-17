import { LevelUp, LevelUpConstructor } from 'levelup';
const level: LevelUpConstructor = require('level');
const levelmem = require('level-mem');
const levelQuery = require('level-queryengine');
const jsonQueryEngine = require('jsonquery-engine');

type SublevelFactory = (db: LevelUp, namespace: string, opts?: {}) => LevelUp;
const sublevel: SublevelFactory = require('subleveldown');

import { AbstractDatabase, ReadStreamOptions, Query } from './models';
import { FlexelTable } from './table';
import { FlexelQueue } from './queue';
import { FlexelStack } from './stack';
import { advancedJsonEncoding, createLogger } from './utils';

const logger = createLogger('flexel');

export class FlexelDatabase implements AbstractDatabase {

	private _db: LevelUp;

	/**
	 * Creates a flexel instance from an in-memory leveldown store.
	 */
	constructor();
	/**
	 * Creates a flexel instance from the path to a leveldown store.
	 *
	 * @param {string} path The path to the database.
	 */
	constructor(path: string);
	/**
	 * Creates a flexel instance using the provided LevelUp instance.
	 *
	 * @param {LevelUp} db The levelup instance.
	 */
	constructor(db: LevelUp);

	constructor(path?: LevelUp | string) {
		if (!new.target) return new FlexelDatabase(path as any);
		let db: LevelUp;

		if (!path) {
			logger(`Creating in-memory database...`);
			db = levelmem(null, { valueEncoding: advancedJsonEncoding });
		} else if (typeof path === 'string') {
			logger(`Creating/Loading database at "${path}"...`);
			db = level(path, { valueEncoding: advancedJsonEncoding });
		} else {
			logger(`Using provided database...`);
			db = path;
		}

		if (!(db && db.get && db.put && db.del && db.createReadStream)) {
			throw new Error('Flexel requires a LevelUp instance!');
		}

		db = levelQuery(db);
		(db as any).query.use(jsonQueryEngine());

		this._db = db;
	}

	public async get<TValue>(key: any): Promise<TValue> {
		return new Promise<TValue>((resolve, reject) => {
			this._db.get(key, (err, value) => {
				if (err) {
					if (err.notFound) return resolve(null);
					return reject(err);
				}
				resolve(value);
			});
		});
	}

	public async put<TValue>(key: any, value: TValue): Promise<TValue> {
		return new Promise<TValue>((resolve, reject) => {
			this._db.put(key, value, (err) => {
				if (err) {
					return reject(err);
				}
				resolve(value);
			});
		});
	}

	public async del(key: any): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this._db.del(key, (err) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	public query<T>(query: Query<T>): Promise<T[]> {
		return new Promise<T[]>((resolve, reject) => {
			let results: T[] = [];
			(this._db as any).query(query)
				.on('data', (item: T) => {
					if (typeof item === 'undefined' || item === null) return;
					
					results.push(item);
				})
				.on('end', () => resolve(results))
				.on('error', reject);
		});
	}

	public createReadStream(options?: ReadStreamOptions): NodeJS.ReadableStream {
		return this._db.createReadStream(Object.assign({
			reverse: false,
			limit: -1,
			keys: true,
			values: true
		}, options)) as NodeJS.ReadableStream;
	}

	public sub(namespace: string): FlexelDatabase {
		let sub = sublevel(this._db, namespace, { valueEncoding: advancedJsonEncoding });
		return new FlexelDatabase(sub);
	}

	public table<T>(namespace: string, key: Extract<keyof T, string>) {
		let sub = this.sub(namespace);
		return new FlexelTable<T>(sub, key);
	}

	public queue<T>(namespace: string): FlexelQueue<T> {
		let sub = this.sub(namespace);
		return new FlexelQueue<T>(sub);
	}

	public stack<T>(namespace: string): FlexelStack<T> {
		let sub = this.sub(namespace);
		return new FlexelStack<T>(sub);
	}
}