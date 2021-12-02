'use strict';

const { struct } = require('@janiscommerce/superstruct');

const MongoDBError = require('../mongodb-error');

const indexesStruct = struct([
	struct.partial({
		name: 'string',
		key: 'object',
		unique: 'boolean?',
		expireAfterSeconds: 'number?',
		partialFilterExpression: 'object?',
		sparse: 'boolean?'
	})
]);

module.exports = indexes => {
	try {
		indexesStruct(indexes);
	} catch(err) {
		throw new MongoDBError(`Invalid index: ${err.message}`, MongoDBError.codes.INVALID_INDEX);
	}
};
