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

/**
 * @class ConfigValidator
 * @classdesc Validates config struct
 */
module.exports = class ConfigValidator {

	/**
     * Validate the received config struct
     * @throws if the struct is invalid
     */
	static validate(config) {

		try {

			config = configStruct(config);

			config.host = this.parseHost(config.host, config.protocol);

			return config;

		} catch(e) {
			e.message = `Error validating connection config: ${e.message}`;
			throw new MongoDBError(e, MongoDBError.codes.INVALID_CONFIG);
		}
	}

	static parseHost(host, protocol) {

		// Avoid protocol and writeConcert duplication

		let parsedHost = host
			.replace(protocol, '')
			.replace('w=majority', '')
			.replace('?&', '?');

		if(['?', '&'].includes(parsedHost.substr(-1, 1)))
			parsedHost = parsedHost.slice(0, -1);

		return parsedHost;
	}
};
