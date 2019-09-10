'use strict';

const MongoDBConfigError = require('./mongodb-config-error');

const MONGODB_CONFIG_STRUCT = {
	protocol: {
		type: 'string'
	},
	host: {
		type: 'string'
	},
	port: {
		type: 'number'
	},
	user: {
		type: 'string'
	},
	password: {
		type: 'string'
	},
	database: {
		type: 'string',
		required: true
	},
	limit: {
		type: 'number'
	}
};

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

		if(!config || typeof config !== 'object' || Array.isArray(config))
			throw new MongoDBConfigError('Invalid config: Should be an object.', MongoDBConfigError.codes.INVALID_CONFIG);

		for(const [setting, terms] of Object.entries(MONGODB_CONFIG_STRUCT)) {

			switch(typeof config[setting]) {

				case terms.type:
					break;

				case 'undefined':
					if(terms.required)
						throw new MongoDBConfigError(`Invalid config: '${setting}' is required.`, MongoDBConfigError.codes.REQUIRED_SETTING);
					break;

				default:
					throw new MongoDBConfigError(`Invalid setting '${setting}': Expected ${terms.type} but received ${typeof config[setting]}.`,
						MongoDBConfigError.codes.INVALID_SETTING);

			}

		}

	}

}

module.exports = ConfigValidator;
