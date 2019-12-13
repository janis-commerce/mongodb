'use strict';

const { MongoClient, ObjectID } = require('mongodb');

const MongoDBError = require('./mongodb-error');

const clients = {};
const dbs = {};

module.exports.ObjectID = ObjectID;

module.exports.MongoWrapper = class MongoWrapper {

	/**
	 * Checks that a valid connection is set, and set's it otherwise
	 *
	 * @return {Promise} A promise that resolves when the DB connection is established
	 */
	static async getDb(config) {

		const dbConfigKey = this.getConfigKey(config);

		if(!dbs[dbConfigKey] || !dbs[dbConfigKey][config.database]) {

			if(!clients[dbConfigKey] || !clients[dbConfigKey].isConnected()) {
				try {
					clients[dbConfigKey] = await this.connect(config);
				} catch(err) {
					throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
				}
			}

			dbs[dbConfigKey][config.database] = clients[dbConfigKey].db(this.config.database);
		}

		return dbs[dbConfigKey][config.database];
	}

	static getUserPrefix(config) {
		return config.user ? `${config.user}:${config.password}@` : '';
	}

	static getConfigKey(config) {
		return `${config.protocol}${this.getUserPrefix(config)}${config.host}:${config.port}`;
	}

	static connect(config) {
		return MongoClient.connect(

			`${config.protocol}${this.getUserPrefix(config)}${config.host}:${config.port}/${config.database}`,
			{
				useNewUrlParser: true,
				useUnifiedTopology: true,
				w: 1 // Required by Mongo Atlas (or clusters)
			}
		);
	}

};
