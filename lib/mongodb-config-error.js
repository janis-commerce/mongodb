'use strict';

class MongoDBConfigError extends Error {

	static get codes() {

		return {
			INVALID_CONFIG: 1,
			INVALID_SETTING: 2,
			REQUIRED_SETTING: 3
		};

	}

	constructor(err, code) {
		super(err);
		this.message = err.message || err;
		this.code = code;
		this.name = 'MongoDBConfigError';
	}
}

module.exports = MongoDBConfigError;
