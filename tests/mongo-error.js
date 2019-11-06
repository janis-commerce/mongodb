'use strict';

const assert = require('assert');

const MongoDBError = require('../lib/mongodb-error');

describe('MongoDB Error', () => {

	it('Should accept a message error and a code', () => {
		const error = new MongoDBError('Some error', MongoDBError.codes.INVALID_MODEL);

		assert.strictEqual(error.message, 'Some error');
		assert.strictEqual(error.code, MongoDBError.codes.INVALID_MODEL);
		assert.strictEqual(error.name, 'MongoDBError');
	});

	it('Should accept an error instance and a code', () => {

		const previousError = new Error('Some error');

		const error = new MongoDBError(previousError, MongoDBError.codes.INVALID_MODEL);

		assert.strictEqual(error.message, 'Some error');
		assert.strictEqual(error.code, MongoDBError.codes.INVALID_MODEL);
		assert.strictEqual(error.name, 'MongoDBError');
		assert.strictEqual(error.previousError, previousError);
	});
});
