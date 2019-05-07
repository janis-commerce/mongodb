'use strict';

class MongoDBError extends Error {

	static get codes() {

		return {
			MODEL_EMPTY_INDEXES: 1,
			EMPTY_INDEXES: 2
		};

	}

	constructor(err) {
		super(err);
		this.message = err.message || err;
		this.name = 'MongoDBError';
	}
}

module.exports = MongoDBError;
