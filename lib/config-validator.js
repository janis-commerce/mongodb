'use strict';

const Validator = require('fastest-validator');

const MongoDBError = require('./mongodb-error');

const validator = new Validator();

const schema = {
	connectionString: { type: 'string', optional: true },
	protocol: { type: 'string', optional: true, default: 'mongodb://' },
	host: { type: 'string', optional: true, default: 'localhost' },
	port: { type: 'number', optional: true },
	user: { type: 'string', optional: true, default: '' },
	password: { type: 'string', optional: true, default: '' },
	database: { type: 'string', optional: true },
	limit: { type: 'number', optional: true, default: 500 }
};

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

		const result = validator.validate(config, schema);

		if(result !== true)
			throw new MongoDBError(`Config validation error: ${JSON.stringify(result)}`, MongoDBError.codes.INVALID_CONFIG);

		config.host = this.parseHost(config.host, config.protocol);

		return config;
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
