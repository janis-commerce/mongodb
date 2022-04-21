'use strict';

module.exports = class MongoDBError extends Error {

	static get codes() {

		return {
			MODEL_EMPTY_UNIQUE_INDEXES: 1,
			EMPTY_UNIQUE_INDEXES: 2,
			INVALID_MODEL: 3,
			MONGODB_INTERNAL_ERROR: 4,
			INVALID_CONFIG: 5,
			INVALID_ITEM: 6,
			INVALID_DISTINCT_KEY: 7,
			INVALID_FILTER_TYPE: 8,
			INVALID_INCREMENT_DATA: 9,
			INVALID_INDEX: 10,
			INVALID_STAGES: 11
		};

	}

	constructor(err, code) {
		super(err.message || err);
		this.code = code;
		this.name = 'MongoDBError';

		if(err instanceof Error)
			this.previousError = err;
	}
};
