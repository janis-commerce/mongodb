'use strict';

const { MongoClient, ObjectID } = require('mongodb');

const MongoDBError = require('./mongodb-error');

/** @type {Object<string, MongoClient>} */
const clients = {};

/** @type {Object<string, <string, MongoClient>>} */
const dbs = {};

/**
 * @template T
 * @callback QueryCallback
 * @param {import('mongodb').Collection} collection
 * @returns {T}
 */

module.exports.ObjectID = ObjectID;

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

		const dbConfigKey = this.configKey;

		if(!dbs[dbConfigKey] || !dbs[dbConfigKey][config.database]) {

			if(!clients[dbConfigKey]) {
				try {
					clients[dbConfigKey] = await this.connect(config);
				} catch(err) {
					throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
				}
			}

			if(!dbs[dbConfigKey])
				dbs[dbConfigKey] = {};

			dbs[dbConfigKey][config.database] = clients[dbConfigKey].db(this.config.database);
		}

		return dbs[dbConfigKey][config.database];
	}

	connect() {
		const mongoClient = new MongoClient(this.connectionString, this.connectionParams);
		return mongoClient.connect();
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
};
