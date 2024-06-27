'use strict';

const MongoDB = require('../../lib/mongodb');

let mongodb;

/**
 * @returns {MongoDB}
 */
module.exports.getMongodbInstance = () => {

	if(!mongodb) {
		mongodb = new MongoDB({
			protocol: 'mongodb://',
			host: 'mongodb-integration-tests-db.localhost',
			port: 27017,
			database: 'test'
		});
	}
	return mongodb;
};
