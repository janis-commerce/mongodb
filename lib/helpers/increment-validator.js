'use strict';

const { struct } = require('superstruct');

const MongoDBError = require('../mongodb-error');

const incrementStruct = struct.partial({
	data: 'number'
});

module.exports = class IncrementValidator {

	/**
	 * Validate the Increment Data Values to be a number type
	 * @param {Object} incrementData
	 * @throws if the struct is invalid
	 */
	static validate(incrementData) {

		try {
			if(typeof incrementData !== 'object' || Array.isArray(incrementData) || !Object.keys(incrementData).length)
				throw new Error('Must be An Object not empty');

			Object.values(incrementData).forEach(increment => incrementStruct({ data: increment }));
			return incrementData;

		} catch(e) {
			e.message = `Error validating Increment Data: ${e.message}`;
			throw new MongoDBError(e, MongoDBError.codes.INVALID_INCREMENT_DATA);
		}
	}

};
