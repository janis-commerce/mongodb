'use strict';

const MongoDBError = require('../mongodb-error');

module.exports = class IndexesHelper {

	static validate(index) {

		try {

			if(!index || typeof index !== 'object' || Array.isArray(index))
				throw new Error('Should exist and must be an object');

			const { key, name, unique } = index;

			if(!key || typeof key !== 'object' || Array.isArray(key))
				throw new Error('key property is required, also should be an object');

			if(typeof name !== 'string')
				throw new Error('name property is required, also should be a string');

			if(unique && typeof unique !== 'boolean')
				throw new Error('unique property should be a boolean');

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
