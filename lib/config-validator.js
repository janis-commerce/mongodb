'use strict';

const { struct } = require('superstruct');

const MongoDBError = require('./mongodb-error');

const configStruct = struct.partial({
	protocol: 'string?',
	host: 'string?',
	port: 'number?',
	user: 'string?',
	password: 'string?',
	database: 'string',
	limit: 'number?'
}, {
	protocol: 'mongodb://',
	host: 'localhost',
	port: 27017,
	user: '',
	password: '',
	limit: 500
});

const incrementStruct = struct.partial({
	data: 'number'
});

/**
 * @class ConfigValidator
 * @classdesc Validates config struct
 */
class ConfigValidator {

	/**
     * Validate the received config struct
     * @throws if the struct is invalid
     */
	static validate(config) {
		try {
			return configStruct(config);
		} catch(e) {
			e.message = `Error validating connection config: ${e.message}`;
			throw new MongoDBError(e, MongoDBError.codes.INVALID_CONFIG);
		}
	}

	/**
	 * Validate the Increment Data Values to be a number type
	 * @param {Object} incrementData
	 * @throws if the struct is invalid
	 */
	static validateIncrementData(incrementData) {

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

}

module.exports = ConfigValidator;
