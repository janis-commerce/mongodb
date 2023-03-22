'use strict';

const { MongoClient, ObjectId } = require('mongodb');

const Events = require('@janiscommerce/events');

const MongoDBError = require('./mongodb-error');

/** @type {Object<string, MongoClient|Promise<MongoClient>>} */
const clients = {};

/** @type {Object<string, <string, MongoClient>>} */
const dbs = {};

/** @type {Object<boolean} */
let closeEventWasAdded = false;

/**
 * @template T
 * @callback QueryCallback
 * @param {import('mongodb').Collection} collection
 * @returns {T}
 */

module.exports.ObjectId = ObjectId;

module.exports.MongoWrapper = class MongoWrapper {

	constructor(config) {
		this.config = config;
	}

	get configKey() {

		const url = new URL(this.connectionString);

		url.pathname = '';
		url.search = '';

		return url.href;
	}

	get connectionString() {

		const url = new URL(`${this.config.protocol}${this.config.host}`);

		if(this.config.port)
			url.port = this.config.port;

		if(this.config.database)
			url.pathname = this.config.database;

		if(this.config.user)
			url.username = this.config.user;

		if(this.config.password)
			url.password = this.config.password;

		return url.href;
	}

	get connectionParams() {
		return {
			writeConcern: {
				w: 1 // Required by Mongo Atlas (or clusters)
			}
		};
	}

	/**
	 * Checks that a valid connection is set, and set's it otherwise
	 *
	 * @return {Promise<import('mongodb').Db>} A promise that resolves when the DB connection is established
	 */
	async getDb() {

		const { config } = this;
		const { database } = config;

		const dbConfigKey = this.configKey;

		if(!dbs[dbConfigKey] || !dbs[dbConfigKey][database]) {

			try {

				const mustConnect = !clients[dbConfigKey];

				if(mustConnect)
					clients[dbConfigKey] = this.connect(config);

				if(clients[dbConfigKey] instanceof Promise)
					clients[dbConfigKey] = await clients[dbConfigKey];

				if(mustConnect && this.shouldCloseConnection() && !closeEventWasAdded) {
					Events.once('janiscommerce.ended', this.closeConnections);
					closeEventWasAdded = true;
				}

			} catch(err) {
				delete clients[dbConfigKey];
				throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
			}

			if(!dbs[dbConfigKey])
				dbs[dbConfigKey] = {};

			dbs[dbConfigKey][database] = clients[dbConfigKey].db(database);
		}

		return dbs[dbConfigKey][database];
	}

	connect() {
		const mongoClient = new MongoClient(this.connectionString, this.connectionParams);
		return mongoClient.connect();
	}

	shouldCloseConnection() {
		return process.env.CLOSE_MONGODB_CONNECTIONS !== 'false';
	}

	async closeConnections() {
		await Promise.all(
			Object.entries(clients).map(async ([configKey, client]) => {

				await client.close(true);

				delete clients[configKey];
				delete dbs[configKey];
			})
		);
	}

	/**
	 *
	 * @template T
	 * @param {import('@janiscommerce/model')} model
	 * @param {QueryCallback<T>} queryCallback
	 * @returns {Promise<T>}
	 */
	async makeQuery(model, queryCallback) {

		const db = await this.getDb();

		return queryCallback(db.collection(model.constructor.table));
	}

	async dropDatabase() {

		const db = await this.getDb();

		return db.dropDatabase();
	}

	async dropCollection(collection) {

		const db = await this.getDb();

		return db.collection(collection).drop();
	}

	async deleteAllDocuments(collection, filter = {}) {

		const db = await this.getDb();

		return db.collection(collection).deleteMany(filter);
	}

	static _cleanCloseFlag() {
		// testing proposes
		closeEventWasAdded = false;
	}
};
