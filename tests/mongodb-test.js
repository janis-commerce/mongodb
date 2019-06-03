'use strict';

const assert = require('assert');
const sinon = require('sinon');
const mock = require('mock-require');

mock('mongodb', 'mongo-mock');

const { MongoClient, ObjectID } = require('mongodb');

const { MongoDB, MongoDBError } = require('./../mongodb');

/* eslint-disable prefer-arrow-callback */

const sandbox = sinon.createSandbox();

class Model {

	get dbname() {
		return 'myDB';
	}

	static get indexes() {
		return [
			'values'
		];
	}

	getTable() {
		return 'table';
	}
}

const mongodb = new MongoDB({
	host: 'mongodb://localhost:3306/fizzmod',
	user: 'root',
	db: 'myDB'
});

const model = new Model();

describe('MongoDB', function() {

	afterEach(() => {
		sandbox.restore();
	});

	describe('handled errors', function() {

		describe('getFilter()', function() {

			it('should explode 😃🔥 with "model requires indexes"', function() {

				assert.throws(() => {
					mongodb.getFilter({});
				}, {
					name: 'MongoDBError',
					code: MongoDBError.codes.MODEL_EMPTY_INDEXES
				});
			});

			it('should explode 😃🔥 with "operation requires indexes"', function() {

				assert.throws(() => {
					mongodb.getFilter(model);
				}, {
					name: 'MongoDBError',
					code: MongoDBError.codes.EMPTY_INDEXES
				});

			});
		});
	});

	describe('checkConnection()', function() {

		it('should call MongoClient connect', async function() {

			const spy = sandbox.spy(MongoClient, 'connect');

			try {
				await mongodb.checkConnection();
			} catch(err) {
				// nothing...
			}

			sandbox.assert.calledOnce(spy);
		});
	});

	describe('formatIndex()', function() {
		it('should return formatted index object', function() {
			assert.deepEqual(typeof mongodb.formatIndex('foo'), 'object');
		});
	});

	describe('createIndexes()', function() {
		it('should call ObjectID', async function() {
			
		});
	});

});
