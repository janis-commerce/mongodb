'use strict';

const { MongoClient, ObjectId } = require('mongodb');

const MongoDBError = require('./mongodb-error');

/** @type {Object<string, MongoClient|Promise<MongoClient>>} */
const clients = {};

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

		if(this.config.connectionString)
			return this.config.connectionString;

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

		const dbConfigKey = this.configKey;

		await this.connect(dbConfigKey);

		return clients[dbConfigKey].db(this.config.database);
	}

	async connect(dbConfigKey) {

		try {

			if(!clients[dbConfigKey]) {
				const mongoClient = new MongoClient(this.connectionString, this.connectionParams);
				clients[dbConfigKey] = mongoClient.connect();
			}

			if(clients[dbConfigKey] instanceof Promise)
				clients[dbConfigKey] = await clients[dbConfigKey];

		} catch(err) {
			delete clients[dbConfigKey];
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
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

		return db.dropDatabase({
			...process.env.AWS_LAMBDA_FUNCTION_NAME && { comment: process.env.AWS_LAMBDA_FUNCTION_NAME }
		});
	}

	async dropCollection(collection) {

		const db = await this.getDb();

		return db.collection(collection).drop({
			...process.env.AWS_LAMBDA_FUNCTION_NAME && { comment: process.env.AWS_LAMBDA_FUNCTION_NAME }
		});
	}

	async deleteAllDocuments(collection, filter = {}) {

		const db = await this.getDb();

		return db.collection(collection).deleteMany(filter, {
			...process.env.AWS_LAMBDA_FUNCTION_NAME && { comment: process.env.AWS_LAMBDA_FUNCTION_NAME }
		});
	}
};
