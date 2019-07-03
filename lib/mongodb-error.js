'use strict';

class MongoDBError extends Error {

	static get codes() {

		return {
			MODEL_EMPTY_UNIQUE_INDEXES: 1,
			EMPTY_UNIQUE_INDEXES: 2,
			INVALID_MODEL: 3,
			MONGODB_INTERNAL_ERROR: 4,
			INVALID_CONFIG: 5
		};

	}

	constructor(err, code) {
		super(err);
		this.message = err.message || err;
		this.code = code;
		this.name = 'MongoDBError';
	}
}

module.exports = MongoDBError;
