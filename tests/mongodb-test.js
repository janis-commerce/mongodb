'use strict';

/* eslint-disable no-unused-vars */

const assert = require('assert');
const sinon = require('sinon');

const { MongoClient, ObjectID } = require('mongodb');

const { MongoDB, MongoDBError } = require('./../mongodb');

/* eslint-disable prefer-arrow-callback */

describe('MongoDB', function() {

	const mongodb = new MongoDB({});

	// MongoDB.client class fake
	mongodb.client = {
		db: () => {
			return {
				collection: table => {
					if(!table)
						throw new Error();
					else {
						return {
							createIndex: index => {
								if(!index)
									throw new Error();
							},
							find: filters => {
								if(!filters)
									throw new Error();
								else {
									return {
										limit: limit => {
											if(!limit)
												throw new Error();
											else {
												return {
													toArray: () => {}
												};
											}
										}
									};
								}
							}
						};
					}
				}
			};
		}
	};

	class Model {

		static get indexes() {
			return [
				'foo',
				'bar'
			];
		}

		getTable() {
			return 'table';
		}
	}

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

			it('should explode 😃🔥 with "Operation requires indexes"', function() {

				const model = new Model();

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

		const stubExecute = result => sinon.stub(MongoClient.prototype, 'connect').callsFake(() => result);

		it('should explode 😃🔥', async function() {

			await assert.rejects(mongodb.checkConnection());

		});

		it('should not explode 😱🔥', async function() {

			const stub = stubExecute(
				Promise.resolve()
			);

			await assert.doesNotReject(mongodb.checkConnection());

			stub.restore();
		});
	});

	describe('formatIndex()', function() {
		it('should return formatted index object', function() {
			assert.equal(typeof mongodb.formatIndex('index'), 'object');
		});
	});

	describe('createIndexes()', function() {

		// const checkConnectionStub = result => sinon.stub(MongoDB.prototype, 'checkConnection').callsFake(() => result);
		// checkConnectionStub(true);

		const model = new Model();

		it('should not explode 😱🔥', async function() {
			await assert.doesNotReject(mongodb.createIndexes(model));
		});

	});

});
