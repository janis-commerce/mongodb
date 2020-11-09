'use strict';

const { MongoClient, ObjectID } = require('mongodb');

const MongoDBError = require('./mongodb-error');

const clients = {};
const dbs = {};

module.exports.ObjectID = ObjectID;

module.exports.MongoWrapper = class MongoWrapper {

	constructor(config) {
		this.config = config;
	}

	/**
	 * Checks that a valid connection is set, and set's it otherwise
	 *
	 * @return {Promise} A promise that resolves when the DB connection is established
	 */
	async getDb() {

		const { config } = this;

		const dbConfigKey = this.configKey;

		if(!dbs[dbConfigKey] || !dbs[dbConfigKey][config.database]) {

			if(!clients[dbConfigKey] || !clients[dbConfigKey].isConnected()) {
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

	get userPrefix() {
		return this.config.user ? `${this.config.user}:${this.config.password}@` : '';
	}

	get configKey() {
		return `${this.config.protocol}${this.userPrefix}${this.config.host}:${this.config.port}`;
	}

	connect() {

		const { config } = this;

		return MongoClient.connect(
			`${config.protocol}${this.userPrefix}${config.host}:${config.port}/${config.database}`,
			{
				useNewUrlParser: true,
				useUnifiedTopology: true,
				w: 1 // Required by Mongo Atlas (or clusters)
			}
		);
	}

	async makeQuery(model, queryCallback) {

		const db = await this.getDb();

		return queryCallback(db.collection(model.constructor.table));
	}

	async dropDatabase() {

		const db = await this.getDb();

		return db.dropDatabase();
	}

};
