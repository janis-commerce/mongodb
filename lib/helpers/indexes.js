'use strict';

const { struct } = require('superstruct');

const MongoDBError = require('../mongodb-error');

const indexStruct = struct.partial({
	name: 'string',
	key: 'object',
	unique: 'boolean?'
});

module.exports = class IndexesHelper {

	static validate(index) {

		try {
			indexStruct(index);
		} catch(err) {
			throw new MongoDBError(`Invalid index: ${err.message}`, MongoDBError.codes.INVALID_INDEX);
		}
	}

	static format(indexes) {

		return indexes.map(({ key, name, unique }) => (
			{
				key,
				name,
				unique: unique || false
			}
		));
	}
};
