'use strict';

const MongoDB = require('../../lib/mongodb');

let mongodb;

/**
 * @returns {MongoDB}
 */
module.exports.getMongodbInstance = () => {

	if(!mongodb) {

		if(!process.env.MONGODB_INTEGRATION_URI)
			throw new Error('Missing MONGODB_INTEGRATION_URI env var: run these tests through `npm run test-integration`');

		mongodb = new MongoDB({
			connectionString: process.env.MONGODB_INTEGRATION_URI
		});
	}
	return mongodb;
};
