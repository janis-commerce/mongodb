'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { MongoWrapper, ObjectId } = require('../lib/mongodb-wrapper');
const MongoDBError = require('../lib/mongodb-error');
const MongoDB = require('../lib/mongodb');

describe('MongoDB', () => {

	const createUniqueIndex = index => {
		if(Array.isArray(index)) {
			return {
				name: index.join('_'),
				key: index.reduce((keys, field) => ({ ...keys, [field]: 1 }), {}),
				unique: true
			};
		}

		return {
			name: index,
			key: { [index]: 1 },
			unique: true
		};
	};

	const getModel = (fields, indexes, indexesGetter = 'uniqueIndexes') => {
		class Model {

			static get table() {
				return 'myCollection';
			}

			static get fields() {
				return fields;
			}

			static get [indexesGetter]() {

				if(indexesGetter === 'indexes')
					return indexes.map(index => createUniqueIndex(index));

				return indexes;
			}
		}

		return new Model();
	};

	const config = {
		host: 'localhost',
		database: 'janis-fizzmodarg',
		port: 30400
	};

	const stubMongo = (getDbIsSuccessful, collectionReturnValue) => {

		sinon.stub(MongoWrapper.prototype, 'getDb');

		const collection = sinon.stub().returns(collectionReturnValue);

		if(getDbIsSuccessful)
			MongoWrapper.prototype.getDb.resolves({ collection });
		else
			MongoWrapper.prototype.getDb.rejects(new Error('Error getting DB'));

		return collection;
	};

	const mockChain = (getDbIsSuccessful = true, response = [], collectionExtraData) => {

		const toArray = response instanceof Error ? sinon.stub().rejects(response) : sinon.stub().resolves(response);
		const project = sinon.stub().returns({ toArray });
		const limit = sinon.stub().returns({ project, toArray });
		const skip = sinon.stub().returns({ limit });
		const sort = sinon.stub().returns({ skip });
		const find = sinon.stub().returns({ sort });

		const collection = stubMongo(getDbIsSuccessful, { find, ...(collectionExtraData || {}) });

		return {
			toArray,
			project,
			limit,
			skip,
			sort,
			find,
			collection
		};
	};

	const assertChain = (stubs, collectionName, filters, order, skip, limit, project) => {

		sinon.assert.calledOnceWithExactly(stubs.collection, collectionName);

		sinon.assert.calledOnceWithExactly(stubs.find, filters);

		sinon.assert.calledOnceWithExactly(stubs.sort, order);

		sinon.assert.calledOnceWithExactly(stubs.skip, skip);

		sinon.assert.calledOnceWithExactly(stubs.limit, limit);

		if(project)
			sinon.assert.calledOnceWithExactly(stubs.project, project);

		sinon.assert.calledOnceWithExactly(stubs.toArray);
	};

	beforeEach(() => {
		sinon.stub(MongoWrapper.prototype, 'connect');
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('distinct()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.distinct(null, { key: 'foo' }), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if no distinct key is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.distinct(getModel()), {
				code: MongoDBError.codes.INVALID_DISTINCT_KEY
			});
		});

		it('Should throw if an invalid key is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.distinct(getModel(), { key: ['invalid'] }), {
				code: MongoDBError.codes.INVALID_DISTINCT_KEY
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const collectionStub = stubMongo(false);

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.distinct(getModel(), { key: 'foo' }), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collectionStub);
		});

		it('Should throw if mongodb distinct method fails', async () => {

			const mongoDistinctStub = sinon.stub().rejects(new Error('Distinct internal error'));

			const collectionStub = stubMongo(true, { distinct: mongoDistinctStub });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.distinct(getModel(), { key: 'foo' }), {
				message: 'Distinct internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');
		});

		it('Should resolve what the mongodb distinct method resolves if no errors ocur', async () => {

			const mongoDistinctStub = sinon.stub().resolves(['bar', 'baz']);

			const collectionStub = stubMongo(true, { distinct: mongoDistinctStub });

			const mongodb = new MongoDB(config);
			const distinctValues = await mongodb.distinct(getModel(), { key: 'foo' });

			assert.deepStrictEqual(distinctValues, ['bar', 'baz']);

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');

			sinon.assert.calledOnceWithExactly(mongoDistinctStub, 'foo', {});
		});

		it('Should pass the parsed filters to the mongodb distinct method', async () => {

			const mongoDistinctStub = sinon.stub().resolves(['bar', 'baz']);

			const collectionStub = stubMongo(true, { distinct: mongoDistinctStub });

			const mongodb = new MongoDB(config);
			const distinctValues = await mongodb.distinct(getModel(), {
				key: 'foo',
				filters: {
					field1: 'value1'
				}
			});

			assert.deepStrictEqual(distinctValues, ['bar', 'baz']);

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');

			sinon.assert.calledOnceWithExactly(mongoDistinctStub, 'foo', { field1: { $eq: 'value1' } });
		});
	});

	describe('get()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.get(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const collection = stubMongo(false);

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.get(getModel(), {}), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collection);
		});

		it('Should throw if mongodb get method fails', async () => {

			const stubs = mockChain(true, new Error('Get internal error'));

			const { collection } = stubs;

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.get(getModel(), {}), {
				message: 'Get internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should resolve what the mongodb find-method-chain resolves if no _id field exists', async () => {

			mockChain(true, [{
				foo: 'bar'
			}]);

			const mongodb = new MongoDB(config);
			const result = await mongodb.get(getModel(), {});

			assert.deepStrictEqual(result, [{
				foo: 'bar'
			}]);
		});

		it('Should resolve what the mongodb find-method-chain resolves mapping _id field to id', async () => {

			mockChain(true, [{
				_id: ObjectId('5df0151dbc1d570011949d86'),
				foo: 'bar'
			}]);

			const mongodb = new MongoDB(config);
			const result = await mongodb.get(getModel(), {});

			assert.deepStrictEqual(result, [{
				id: '5df0151dbc1d570011949d86',
				foo: 'bar'
			}]);
		});

		it('Should pass the default values to the find-method-chain', async () => {

			const stubs = mockChain();

			const mongodb = new MongoDB(config);
			await mongodb.get(getModel(), {});

			assertChain(stubs, 'myCollection', {}, undefined, 0, 500);
		});

		it('Should pass the parsed filters (including id to _id mapping) to the find-method-chain', async () => {

			const stubs = mockChain();

			const mongodb = new MongoDB(config);
			await mongodb.get(getModel({
				otherId: {
					isID: true
				}
			}), {
				filters: {
					foo: 'bar',
					baz: 1,
					id: '5df0151dbc1d570011949d86',
					otherId: ObjectId('5df0151dbc1d570011949d87')
				}
			});

			assertChain(stubs, 'myCollection', {
				foo: {
					$eq: 'bar'
				},
				baz: {
					$eq: 1
				},
				_id: {
					$eq: ObjectId('5df0151dbc1d570011949d86')
				},
				otherId: {
					$eq: ObjectId('5df0151dbc1d570011949d87')
				}
			}, undefined, 0, 500);
		});

		it('Should pass the parsed filters (as OR filters) to the find-method-chain', async () => {

			const stubs = mockChain();

			const date = new Date();

			const mongodb = new MongoDB(config);
			await mongodb.get(getModel({
				otherId: {
					isID: true
				}
			}), {
				filters: [
					{
						foo: 'bar',
						id: '5df0151dbc1d570011949d86',
						otherId: [ObjectId('5df0151dbc1d570011949d87'), '5df0151dbc1d570011949d88']
					},
					{
						baz: {
							type: 'equal',
							value: [1, 2]
						},
						date
					}
				]
			});

			assertChain(stubs, 'myCollection', {
				$or: [
					{
						foo: {
							$eq: 'bar'
						},
						_id: {
							$eq: ObjectId('5df0151dbc1d570011949d86')
						},
						otherId: {
							$in: [ObjectId('5df0151dbc1d570011949d87'), ObjectId('5df0151dbc1d570011949d88')]
						}
					},
					{
						baz: {
							$eq: [1, 2]
						},
						date: {
							$eq: date
						}
					}
				]
			}, undefined, 0, 500);
		});

		it('Should not pass the parsed sort params to the find-method-chain if they are invalid', async () => {

			const stubs = mockChain();

			const mongodb = new MongoDB(config);
			await mongodb.get(getModel(), {
				order: ['invalid']
			});

			assertChain(stubs, 'myCollection', {}, undefined, 0, 500);
		});

		it('Should not pass the parsed sort params to the find-method-chain if they are empty', async () => {

			const stubs = mockChain();

			const mongodb = new MongoDB(config);
			await mongodb.get(getModel(), {
				order: {}
			});

			assertChain(stubs, 'myCollection', {}, undefined, 0, 500);
		});

		it('Should not pass the parsed sort params to the find-method-chain if the direction is invalid', async () => {

			const stubs = mockChain();

			const mongodb = new MongoDB(config);
			await mongodb.get(getModel(), {
				order: {
					foo: 'invalid',
					bar: ['notAString']
				}
			});

			assertChain(stubs, 'myCollection', {}, undefined, 0, 500);
		});

		it('Should pass the parsed sort params to the find-method-chain', async () => {

			const stubs = mockChain();

			const mongodb = new MongoDB(config);
			await mongodb.get(getModel(), {
				order: {
					foo: 'asc',
					bar: 'desc'
				}
			});

			assertChain(stubs, 'myCollection', {}, {
				foo: 1,
				bar: -1
			}, 0, 500);
		});

		it('Should pass the limit param to the find-method-chain', async () => {

			const stubs = mockChain();

			const mongodb = new MongoDB(config);
			await mongodb.get(getModel(), {
				limit: 100
			});

			assertChain(stubs, 'myCollection', {}, undefined, 0, 100);
		});

		it('Should pass the skip param based on page number to the find-method-chain', async () => {

			const stubs = mockChain();

			const mongodb = new MongoDB(config);
			await mongodb.get(getModel(), {
				page: 2
			});

			assertChain(stubs, 'myCollection', {}, undefined, 500, 500);
		});

		it('Should pass the skip param based on page number and limit to the find-method-chain', async () => {

			const stubs = mockChain();

			const mongodb = new MongoDB(config);
			await mongodb.get(getModel(), {
				page: 3,
				limit: 30
			});

			assertChain(stubs, 'myCollection', {}, undefined, 60, 30);
		});

		describe('projection', () => {

			it('Should pass the project param to select fields to the find-method-chain when received fields', async () => {

				const stubs = mockChain();

				const mongodb = new MongoDB(config);
				await mongodb.get(getModel(), {
					fields: ['foo']
				});

				assertChain(stubs, 'myCollection', {}, undefined, 0, 500, { foo: true });
			});

			it('Should pass the project param to exclude fields to the find-method-chain when received excludeFields', async () => {

				const stubs = mockChain();

				const mongodb = new MongoDB(config);
				await mongodb.get(getModel(), {
					excludeFields: ['foo']
				});

				assertChain(stubs, 'myCollection', {}, undefined, 0, 500, { foo: false });
			});

			it('Should only pass the project param to select fields to the find-method-chain when received fields and excludeFields', async () => {

				const stubs = mockChain();

				const mongodb = new MongoDB(config);
				await mongodb.get(getModel(), {
					fields: ['foo'],
					excludeFields: ['bar']
				});

				assertChain(stubs, 'myCollection', {}, undefined, 0, 500, { foo: true });
			});
		});
	});

	describe('save()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.save(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const collection = stubMongo(false);

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.save(getModel(), { ...item }), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collection);
		});

		it('Should throw if mongodb save method fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const findOneAndUpdate = sinon.stub().rejects(new Error('findOneAndUpdate internal error'));

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.save(getModel(), { ...item }), {
				message: 'findOneAndUpdate internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should use id as filter if it\'s passed', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				id,
				otherId: '5df0151dbc1d570011949d87',
				$set: {
					name: 'Some name'
				},
				$inc: {
					quantity: 2
				}
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			const result = await mongodb.save(getModel(), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
				_id: {
					$eq: ObjectId(id)
				}
			}, {
				$set: {
					otherId: '5df0151dbc1d570011949d87',
					name: 'Some name'
				},
				$inc: {
					quantity: 2
				},
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: sinon.match.date }
			}, { upsert: true, returnNewDocument: true });
		});

		it('Should use a unique index as filter if id is not passed', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name'
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			const result = await mongodb.save(getModel({
				otherId: {
					isID: true
				}
			}, ['otherId']), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
				otherId: {
					$eq: ObjectId('5df0151dbc1d570011949d87')
				}
			}, {
				$set: {
					otherId: ObjectId('5df0151dbc1d570011949d87'),
					name: 'Some name'
				},
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: sinon.match.date }
			}, { upsert: true, returnNewDocument: true });
		});

		['indexes', 'uniqueIndexes'].forEach(indexesGetter => {
			context(`When model has ${indexesGetter} getter`, () => {
				it('Should use a multi-field unique index as filter if id is not passed', async () => {

					const id = '5df0151dbc1d570011949d86';

					const item = {
						otherId: '5df0151dbc1d570011949d87',
						name: 'Some name'
					};

					const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

					const collection = stubMongo(true, { findOneAndUpdate });

					const mongodb = new MongoDB(config);
					const result = await mongodb.save(getModel({}, [
						'notPassedField',
						['otherId', 'name']
					], indexesGetter), { ...item });

					assert.deepStrictEqual(result, id);

					sinon.assert.calledOnceWithExactly(collection, 'myCollection');

					sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
						otherId: {
							$eq: '5df0151dbc1d570011949d87'
						},
						name: {
							$eq: 'Some name'
						}
					}, {
						$set: {
							otherId: '5df0151dbc1d570011949d87',
							name: 'Some name'
						},
						$currentDate: { dateModified: true },
						$setOnInsert: { dateCreated: sinon.match.date }
					}, { upsert: true, returnNewDocument: true });
				});
			});
		});

		it('Should use a unique index as filter if id not exist', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name'
			};

			const findOneAndUpdate = sinon.stub().resolves({ lastErrorObject: { upserted: ObjectId(id) }, value: null });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			const result = await mongodb.save(getModel({
				otherId: {
					isID: true
				}
			}, ['otherId']), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
				otherId: {
					$eq: ObjectId('5df0151dbc1d570011949d87')
				}
			}, {
				$set: {
					otherId: ObjectId('5df0151dbc1d570011949d87'),
					name: 'Some name'
				},
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: sinon.match.date }
			}, { upsert: true, returnNewDocument: true });
		});

		it('Should use extra default insert values', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				id,
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name'
			};

			const setOnInsert = {
				status: 'active'
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			const result = await mongodb.save(getModel(), { ...item }, setOnInsert);

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
				_id: {
					$eq: ObjectId(id)
				}
			}, {
				$set: {
					otherId: '5df0151dbc1d570011949d87',
					name: 'Some name'
				},
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: sinon.match.date, ...setOnInsert }
			}, { upsert: true, returnNewDocument: true });
		});

		it('Should throw if no unique indexes are defined and id is not passed', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name'
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.save(getModel({}, []), { ...item }), {
				code: MongoDBError.codes.MODEL_EMPTY_UNIQUE_INDEXES
			});

			sinon.assert.notCalled(collection);
			sinon.assert.notCalled(findOneAndUpdate);
		});

		it('Should throw if no unique indexes can be matched', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name'
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.save(getModel({}, ['otherIndex']), { ...item }), {
				code: MongoDBError.codes.EMPTY_UNIQUE_INDEXES
			});

			sinon.assert.notCalled(collection);
			sinon.assert.notCalled(findOneAndUpdate);
		});

		it('Should remove conflictive fields from data', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				id,
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name',
				dateCreated: new Date(),
				dateModified: new Date()
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			const result = await mongodb.save(getModel(), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
				_id: {
					$eq: ObjectId(id)
				}
			}, {
				$set: {
					otherId: '5df0151dbc1d570011949d87',
					name: 'Some name'
				},
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: sinon.match.date }
			}, { upsert: true, returnNewDocument: true });
		});

		it('Should remove conflictive fields from default insert values', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				id,
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name',
				dateCreated: new Date(),
				dateModified: new Date(),
				status: 'active'
			};

			const setOnInsert = {
				status: 'inactive',
				quantity: 100
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			const result = await mongodb.save(getModel(), { ...item }, setOnInsert);

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
				_id: {
					$eq: ObjectId(id)
				}
			}, {
				$set: {
					otherId: '5df0151dbc1d570011949d87',
					name: 'Some name',
					status: 'active'
				},
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: sinon.match.date, quantity: 100 }
			}, { upsert: true, returnNewDocument: true });
		});

		it('Should map the model defined ID fields to ObjectIds', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				id,
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name'
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			const result = await mongodb.save(getModel({
				otherId: {
					isID: true
				}
			}), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
				_id: {
					$eq: ObjectId(id)
				}
			}, {
				$set: {
					otherId: ObjectId('5df0151dbc1d570011949d87'),
					name: 'Some name'
				},
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: sinon.match.date }
			}, { upsert: true, returnNewDocument: true });
		});

		it('Should send only in $setOnInsert the dateCreated value when received as valid iso date', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				id,
				name: 'Blue rocket',
				dateCreated: '2023-02-22T17:43:45.460Z'
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			const result = await mongodb.save(getModel(), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
				_id: { $eq: ObjectId(id) }
			}, {
				$set: { name: 'Blue rocket' },
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: new Date(item.dateCreated) }
			}, { upsert: true, returnNewDocument: true });
		});

		it('Should send only in $setOnInsert the dateCreated value when received as valid date object', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				id,
				name: 'Blue rocket',
				dateCreated: new Date('2023-02-22T17:43:45.460Z')
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			const result = await mongodb.save(getModel(), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
				_id: { $eq: ObjectId(id) }
			}, {
				$set: { name: 'Blue rocket' },
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: new Date(item.dateCreated) }
			}, { upsert: true, returnNewDocument: true });
		});

		it('Should send current Date when received an invalid date as string', async () => {

			sinon.useFakeTimers();

			const id = '5df0151dbc1d570011949d86';

			const item = {
				id,
				name: 'Blue rocket',
				dateCreated: '22/02/2023' // invalid date
			};

			const findOneAndUpdate = sinon.stub().resolves({ value: { _id: ObjectId(id) } });

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			const result = await mongodb.save(getModel(), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
				_id: { $eq: ObjectId(id) }
			}, {
				$set: { name: 'Blue rocket' },
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: new Date() }
			}, { upsert: true, returnNewDocument: true });
		});
	});

	describe('insert()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.insert(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const collection = stubMongo(false);

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.insert(getModel(), { ...item }), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collection);
		});

		it('Should throw if mongodb insert method fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const insertOne = sinon.stub().rejects(new Error('InsertOne internal error'));

			const collection = stubMongo(true, { insertOne });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.insert(getModel(), { ...item }), {
				message: 'InsertOne internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should map all ID fields and add dateCreated', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name'
			};

			const insertOne = sinon.stub().resolves({ insertedId: ObjectId(id) });

			const collection = stubMongo(true, { insertOne });

			const mongodb = new MongoDB(config);
			const result = await mongodb.insert(getModel({
				otherId: {
					isID: true
				}
			}), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			const expectedItem = {
				otherId: ObjectId('5df0151dbc1d570011949d87'),
				name: 'Some name',
				dateCreated: sinon.match.date
			};

			sinon.assert.calledOnceWithExactly(insertOne, expectedItem);
		});

		it('Should insert item adding the dateCreated value when received as valid iso date', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				name: 'Blue rocket',
				dateCreated: '2023-02-22T17:43:45.460Z'
			};

			const insertOne = sinon.stub().resolves({ insertedId: ObjectId(id) });

			const collection = stubMongo(true, { insertOne });

			const mongodb = new MongoDB(config);
			const result = await mongodb.insert(getModel(), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(insertOne, {
				name: item.name,
				dateCreated: new Date(item.dateCreated)
			});
		});

		it('Should insert item adding the dateCreated value when received as valid date object', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				name: 'Blue rocket',
				dateCreated: new Date('2023-02-22T17:43:45.460Z')
			};

			const insertOne = sinon.stub().resolves({ insertedId: ObjectId(id) });

			const collection = stubMongo(true, { insertOne });

			const mongodb = new MongoDB(config);
			const result = await mongodb.insert(getModel(), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(insertOne, {
				name: item.name,
				dateCreated: new Date(item.dateCreated)
			});
		});

		it('Should insert item using current Date on dateCreated field when received an invalid date as string', async () => {

			sinon.useFakeTimers();

			const id = '5df0151dbc1d570011949d86';

			const item = {
				name: 'Blue rocket',
				dateCreated: 'invalid date'
			};

			const insertOne = sinon.stub().resolves({ insertedId: ObjectId(id) });

			const collection = stubMongo(true, { insertOne });

			const mongodb = new MongoDB(config);
			const result = await mongodb.insert(getModel(), { ...item });

			assert.deepStrictEqual(result, id);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(insertOne, {
				name: item.name,
				dateCreated: new Date()
			});
		});
	});

	describe('update()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.update(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const collection = stubMongo(false);

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.update(getModel(), { ...item }), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collection);
		});

		it('Should throw if mongodb update method fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const updateMany = sinon.stub().rejects(new Error('UpdateMany internal error'));

			const collection = stubMongo(true, { updateMany });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.update(getModel(), { ...item }), {
				message: 'UpdateMany internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should map all ID fields and add dateModified', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name',
				$set: {
					description: 'The description'
				},
				$inc: {
					quantity: -5
				},
				$push: {
					children: {
						id: '5df0151dbc1d570011949d88',
						name: 'Children name'
					}
				}
			};

			const options = { upsert: true };

			const updateMany = sinon.stub().resolves({ modifiedCount: 1 });

			const collection = stubMongo(true, { updateMany });

			const mongodb = new MongoDB(config);
			const result = await mongodb.update(getModel({
				otherId: {
					isID: true
				}
			}), { ...item }, { id }, options);

			assert.deepStrictEqual(result, 1);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			const expectedItem = {
				$set: {
					dateModified: sinon.match.date,
					otherId: ObjectId('5df0151dbc1d570011949d87'),
					name: 'Some name',
					description: 'The description'
				},
				$inc: {
					quantity: -5
				},
				$push: {
					children: {
						id: '5df0151dbc1d570011949d88',
						name: 'Children name'
					}
				}
			};

			sinon.assert.calledOnceWithExactly(updateMany, {
				_id: {
					$eq: ObjectId(id)
				}
			}, expectedItem, options);
		});

		it('Should update with multiple data', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name',
				description: 'The description'
			};

			const item2 = {
				$unset: ['children.5df0151dbc1d570011949d88', 'children.5df0151dbc1d570011949d89']
			};

			const options = { upsert: true };

			const updateMany = sinon.stub().resolves({ modifiedCount: 1 });

			const collection = stubMongo(true, { updateMany });

			const mongodb = new MongoDB(config);

			const result = await mongodb.update(getModel({
				otherId: {
					isID: true
				}
			}), [item, item2], { id }, options);

			assert.deepStrictEqual(result, 1);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			const expectedItem = [
				{
					$set: {
						otherId: ObjectId('5df0151dbc1d570011949d87'),
						name: 'Some name',
						description: 'The description'
					}
				},
				{ $unset: ['children.5df0151dbc1d570011949d88', 'children.5df0151dbc1d570011949d89'] },
				{ $set: { dateModified: sinon.match.date } }
			];

			sinon.assert.calledOnceWithExactly(updateMany, {
				_id: {
					$eq: ObjectId(id)
				}
			}, expectedItem, options);
		});

		it('Should throw with multiple data but multiple stage in one pipeline', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name',
				description: 'The description',
				$push: {
					children: {
						id: '5df0151dbc1d570011949d88',
						name: 'Children name'
					}
				}
			};

			const item2 = {
				$unset: 'children.5df0151dbc1d570011949d88'
			};

			const options = { upsert: true };

			const updateMany = sinon.stub();

			const collection = stubMongo(true, { updateMany });

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.update(getModel({
				otherId: {
					isID: true
				}
			}), [item, item2], { id }, options));


			sinon.assert.notCalled(collection);
			sinon.assert.notCalled(updateMany);
		});
	});

	describe('multiInsert()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiInsert(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if items are not an array', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiInsert(getModel(), {}), {
				code: MongoDBError.codes.INVALID_ITEM
			});
		});

		it('Should throw if items array is empty', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiInsert(getModel(), []), {
				code: MongoDBError.codes.INVALID_ITEM
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const collection = stubMongo(false);

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiInsert(getModel(), [{ ...item }]), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collection);
		});

		it('Should throw if mongodb method fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const insertMany = sinon.stub().rejects(new Error('InsertMany internal error'));

			const collection = stubMongo(true, { insertMany });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiInsert(getModel(), [{ ...item }]), {
				message: 'InsertMany internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should map all ID fields and add dateCreated', async () => {

			const item = {
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name'
			};

			const expectedItem = {
				otherId: ObjectId('5df0151dbc1d570011949d87'),
				name: 'Some name',
				dateCreated: sinon.match.date
			};

			const insertMany = sinon.stub().resolves({
				acknowledged: true,
				insertedCount: 1,
				insertedIds: { 0: ObjectId('5df0151dbc1d570011949d86') }
			});

			const collection = stubMongo(true, { insertMany });

			const mongodb = new MongoDB(config);
			const result = await mongodb.multiInsert(getModel({
				otherId: {
					isID: true
				}
			}), [{ ...item }]);

			sinon.assert.match(result, [{
				...expectedItem,
				otherId: '5df0151dbc1d570011949d87',
				id: '5df0151dbc1d570011949d86'
			}]);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(insertMany, [expectedItem], { ordered: false });
		});

		it('Should not convert the id has ObjectId when hasCustomId is truthy', async () => {

			const customId = 'f168aee3-a534-409c-aee8-b7a160c032bb';

			const item = {
				id: customId,
				name: 'Blue rocket'
			};

			const expectedItem = {
				name: 'Blue rocket',
				dateCreated: sinon.match.date
			};

			const insertMany = sinon.stub().resolves({
				acknowledged: true,
				insertedCount: 1,
				insertedIds: { 0: customId }
			});

			const collection = stubMongo(true, { insertMany });

			class Model {

				static get table() {
					return 'myCollection';
				}

				static get hasCustomId() {
					return true;
				}
			}

			const model = new Model();

			const mongodb = new MongoDB(config);
			const result = await mongodb.multiInsert(model, [{ ...item }]);

			sinon.assert.match(result, [{ ...expectedItem, id: customId }]);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(insertMany, [{ ...expectedItem, _id: customId }], { ordered: false });
		});

		it('Should insert items and not throw when duplicate error', async () => {

			const items = [{
				// already in DB
				id: '5df0151dbc1d570011949d86',
				name: 'Blue shirt'
			}, {
				// not in DB
				id: '5df0151dbc1d570011949d87',
				name: 'Red shirt'
			}];

			const errorMessage = `E11000 duplicate key error collection: someDatabase.myCollection index: _id_ dup key: { _id: ${items[0].id} }`;

			const error = new Error(errorMessage);

			error.result = {
				result: {
					insertedIds: [
						{ index: 0, _id: ObjectId('5df0151dbc1d570011949d88') }, // MongoDB genera un id antes de insertar y devuelve ese
						{ index: 1, _id: ObjectId('5df0151dbc1d570011949d87') }
					],
					writeErrors: [{ index: 0, code: 11000, errmsg: errorMessage, op: items[0] }]
				}
			};

			const insertMany = sinon.stub().rejects(error);

			const collection = stubMongo(true, { insertMany });

			const mongodb = new MongoDB(config);
			const result = await mongodb.multiInsert(getModel(), [...items]);

			sinon.assert.match(result, [{
				...items[1],
				dateCreated: sinon.match.date
			}]);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should return empty array when duplicate error for all items', async () => {

			const items = [{
				// already in DB
				id: '5df0151dbc1d570011949d86',
				name: 'Blue shirt'
			}];

			const errorMessage = `E11000 duplicate key error collection: someDatabase.myCollection index: _id_ dup key: { _id: ${items[0].id} }`;

			const error = new Error(errorMessage);

			error.result = {
				result: {
					insertedIds: [
						{ index: 0, _id: ObjectId('5df0151dbc1d570011949d88') }
					],
					writeErrors: [{ index: 0, code: 11000, errmsg: errorMessage, op: items[0] }]
				}
			};

			const insertMany = sinon.stub().rejects(error);

			const collection = stubMongo(true, { insertMany });

			const mongodb = new MongoDB(config);
			const result = await mongodb.multiInsert(getModel(), [...items]);

			sinon.assert.match(result, []);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should throw error when duplicate error and using failOnDuplicateErrors as true', async () => {

			const items = [{
				// already in DB
				name: 'Blue shirt'
			}];

			const errorMessage = 'E11000 duplicate key error collection: someDatabase.myCollection index: name_unique dup key: { name: Blue shirt }';

			const error = new Error(errorMessage);

			const insertMany = sinon.stub().rejects(error);

			const collection = stubMongo(true, { insertMany });

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.multiInsert(getModel(), [...items], { failOnDuplicateErrors: true }), {
				message: errorMessage,
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

		});
	});

	describe('multiSave()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiSave(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if items are not an array', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiSave(getModel(), {}), {
				code: MongoDBError.codes.INVALID_ITEM
			});
		});

		it('Should throw if items array is empty', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiSave(getModel(), []), {
				code: MongoDBError.codes.INVALID_ITEM
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const collection = stubMongo(false);

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiSave(getModel(), [{ ...item }]), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collection);
		});

		it('Should throw if mongodb bulkWrite method fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const bulkWrite = sinon.stub().rejects(new Error('BulkWrite internal error'));

			const collection = stubMongo(true, { bulkWrite });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiSave(getModel(), [{ ...item }]), {
				message: 'BulkWrite internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should map all using Default Insert Values', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item1 = {
				id,
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name',
				dateCreated: new Date(),
				status: 'active',
				quantity: 100
			};

			const item2 = {
				otherId: '5df0151dbc1d570011949d88',
				name: 'Some name',
				dateCreated: new Date(),
				dateModified: new Date()
			};

			const setOnInsert = {
				status: 'inactive',
				quantity: 100
			};

			const bulkWrite = sinon.stub().resolves({ result: { ok: 2 } });

			const collection = stubMongo(true, { bulkWrite });

			const mongodb = new MongoDB(config);
			const result = await mongodb.multiSave(getModel({
				otherId: {
					isID: true
				}
			}, ['id', 'otherId']), [{ ...item1 }, { ...item2 }], setOnInsert);

			assert.deepStrictEqual(result, true);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			const expectedItems = [
				{
					updateOne: {
						filter: {
							_id: {
								$eq: ObjectId('5df0151dbc1d570011949d86')
							}
						},
						update: {
							$set: {
								otherId: ObjectId('5df0151dbc1d570011949d87'),
								name: 'Some name',
								status: 'active',
								quantity: 100
							},
							$currentDate: { dateModified: true },
							$setOnInsert: { dateCreated: sinon.match.date }
						},
						upsert: true
					}
				},
				{
					updateOne: {
						filter: {
							otherId: {
								$eq: ObjectId('5df0151dbc1d570011949d88')
							}
						},
						update: {
							$set: {
								otherId: ObjectId('5df0151dbc1d570011949d88'),
								name: 'Some name'
							},
							$currentDate: { dateModified: true },
							$setOnInsert: { dateCreated: sinon.match.date, ...setOnInsert }
						},
						upsert: true
					}
				}
			];

			sinon.assert.calledOnceWithExactly(bulkWrite, expectedItems);
		});
	});

	describe('remove()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.remove(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const collection = stubMongo(false);

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.remove(getModel(), { ...item }), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collection);
		});

		it('Should throw if mongodb deleteOne method fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const deleteOne = sinon.stub().rejects(new Error('DeleteOne internal error'));

			const collection = stubMongo(true, { deleteOne });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.remove(getModel(), { ...item }), {
				message: 'DeleteOne internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should delete the item using ID if it\'s defined', async () => {

			const id = '5df0151dbc1d570011949d86';

			const item = {
				id,
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name'
			};

			const deleteOne = sinon.stub().resolves({ deletedCount: 1 });

			const collection = stubMongo(true, { deleteOne });

			const mongodb = new MongoDB(config);
			const result = await mongodb.remove(getModel({
				otherId: {
					isID: true
				}
			}, ['id', 'otherId']), { ...item });

			assert.deepStrictEqual(result, true);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			const expectedItem = {
				_id: {
					$eq: ObjectId(id)
				}
			};

			sinon.assert.calledOnceWithExactly(deleteOne, expectedItem);
		});

		it('Should delete the item using a unique index if ID is not defined', async () => {

			const item = {
				otherId: '5df0151dbc1d570011949d87',
				name: 'Some name'
			};

			const deleteOne = sinon.stub().resolves({ deletedCount: 1 });

			const collection = stubMongo(true, { deleteOne });

			const mongodb = new MongoDB(config);
			const result = await mongodb.remove(getModel({
				otherId: {
					isID: true
				}
			}, ['id', 'otherId']), { ...item });

			assert.deepStrictEqual(result, true);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			const expectedItem = {
				otherId: {
					$eq: ObjectId('5df0151dbc1d570011949d87')
				}
			};

			sinon.assert.calledOnceWithExactly(deleteOne, expectedItem);
		});

		it('Should throw if no unique indexes can be matched', async () => {

			const item = {
				name: 'Some name'
			};

			const deleteOne = sinon.stub().resolves({ deletedCount: 0 });

			const collection = stubMongo(true, { deleteOne });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.remove(getModel({
				otherId: {
					isID: true
				}
			}, ['id', 'otherId']), { ...item }));

			sinon.assert.notCalled(collection);
			sinon.assert.notCalled(deleteOne);
		});
	});

	describe('multiRemove()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiRemove(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const collection = stubMongo(false);

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiRemove(getModel(), { ...item }), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collection);
		});

		it('Should throw if mongodb deleteMany method fails', async () => {

			const item = {
				id: '5df0151dbc1d570011949d86',
				name: 'Some name'
			};

			const deleteMany = sinon.stub().rejects(new Error('DeleteMany internal error'));

			const collection = stubMongo(true, { deleteMany });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.multiRemove(getModel(), { ...item }), {
				message: 'DeleteMany internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should delete the item using the filters received', async () => {

			const id1 = '5df0151dbc1d570011949d86';
			const id2 = '5df0151dbc1d570011949d87';

			const filter = {
				id: [id1, id2],
				otherId: '5df0151dbc1d570011949d88',
				name: 'Some name'
			};

			const deleteMany = sinon.stub().resolves({ deletedCount: 2 });

			const collection = stubMongo(true, { deleteMany });

			const mongodb = new MongoDB(config);
			const result = await mongodb.multiRemove(getModel({
				otherId: {
					isID: true
				}
			}), { ...filter });

			assert.deepStrictEqual(result, 2);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			const expectedFilter = {
				_id: {
					$in: [ObjectId(id1), ObjectId(id2)]
				},
				otherId: {
					$eq: ObjectId('5df0151dbc1d570011949d88')
				},
				name: {
					$eq: 'Some name'
				}
			};

			sinon.assert.calledOnceWithExactly(deleteMany, expectedFilter);
		});
	});

	describe('getTotals()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.getTotals(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should return without calling mongo if last query was empty', async () => {

			const mongodb = new MongoDB(config);

			const countDocuments = sinon.stub();
			const estimatedDocumentCount = sinon.stub();

			const { collection } = mockChain(true, [], { countDocuments, estimatedDocumentCount });

			const model = getModel();

			// Get to populate internal properties
			await mongodb.get(model, {});

			const result = await mongodb.getTotals(model);

			assert.deepStrictEqual(result, {
				total: 0,
				pages: 0
			});

			// Collection se llama una vez para el get
			sinon.assert.calledOnce(collection);
			sinon.assert.notCalled(countDocuments);
			sinon.assert.notCalled(estimatedDocumentCount);
		});

		it('Should calculate totals without calling mongo if length or result is lesser than limit', async () => {

			const mongodb = new MongoDB(config);

			const countDocuments = sinon.stub();
			const estimatedDocumentCount = sinon.stub();

			const { collection } = mockChain(true, [{ a: 1 }, { b: 2 }], { countDocuments, estimatedDocumentCount });

			const model = getModel();

			// Get to populate internal properties
			await mongodb.get(model, {
				limit: 100,
				page: 450
			});

			const result = await mongodb.getTotals(model);

			assert.deepStrictEqual(result, {
				total: 44902,
				pageSize: 100,
				pages: 450,
				page: 450
			});

			// Collection se llama una vez para el get
			sinon.assert.calledOnce(collection);
			sinon.assert.notCalled(countDocuments);
			sinon.assert.notCalled(estimatedDocumentCount);
		});

		context('When get() is not called first', () => {

			it('Should calculate the totals using estimatedDocumentCount()', async () => {

				const mongodb = new MongoDB(config);

				const countDocuments = sinon.spy();
				const estimatedDocumentCount = sinon.stub().resolves(1);

				const collection = stubMongo(true, { countDocuments, estimatedDocumentCount });

				const model = getModel();

				const result = await mongodb.getTotals(model);

				assert.deepStrictEqual(result, {
					total: 1,
					pageSize: 500,
					pages: 1,
					page: 0
				});

				sinon.assert.calledOnce(collection);
				sinon.assert.notCalled(countDocuments);
				sinon.assert.calledOnce(estimatedDocumentCount);
			});
		});

		context('When using filters', () => {

			it('Should throw if mongo countDocuments method fails', async () => {

				const mongodb = new MongoDB(config);

				const countDocuments = sinon.stub().rejects(new Error('countDocuments internal error'));
				const estimatedDocumentCount = sinon.stub();

				const { collection } = mockChain(true, [{ a: 1 }], { countDocuments, estimatedDocumentCount });

				const model = getModel();

				// Get to populate internal properties
				await mongodb.get(model, {
					filters: { status: 'active' },
					limit: 1
				});

				await assert.rejects(() => mongodb.getTotals(model), {
					code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
				});

				// Collection se llama una vez para el get
				sinon.assert.calledTwice(collection);
				sinon.assert.calledOnceWithExactly(countDocuments, {
					status: { $eq: 'active' }
				});

				sinon.assert.notCalled(estimatedDocumentCount);
			});

			it('Should return the totals object for queries with filters, specific page and custom limit using countDocuments()', async () => {

				const mongodb = new MongoDB(config);

				const estimatedDocumentCount = sinon.stub();
				const countDocuments = sinon.stub().resolves(4);

				const { collection } = mockChain(true, [{ a: 3 }, { a: 4 }], { countDocuments, estimatedDocumentCount });

				const model = getModel();

				// Get to populate internal properties
				await mongodb.get(model, {
					filters: { status: 'active' },
					page: 2,
					limit: 2
				});

				const result = await mongodb.getTotals(model);

				assert.deepStrictEqual(result, {
					total: 4,
					pageSize: 2,
					pages: 2,
					page: 2
				});

				// Collection se llama una vez para el get
				sinon.assert.calledTwice(collection);
				sinon.assert.calledOnceWithExactly(countDocuments, {
					status: { $eq: 'active' }
				});

				sinon.assert.notCalled(estimatedDocumentCount);
			});
		});

		context('When not using filters', () => {

			it('Should throw if mongo estimatedDocumentCount method fails', async () => {

				const mongodb = new MongoDB(config);

				const estimatedDocumentCount = sinon.stub().rejects(new Error('estimatedDocumentCount internal error'));
				const countDocuments = sinon.stub();

				const { collection } = mockChain(true, [{ a: 1 }], { estimatedDocumentCount, countDocuments });

				const model = getModel();

				// Get to populate internal properties
				await mongodb.get(model, {
					limit: 1
				});

				await assert.rejects(() => mongodb.getTotals(model), {
					code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
				});

				// Collection se llama una vez para el get
				sinon.assert.calledTwice(collection);
				sinon.assert.calledOnceWithExactly(estimatedDocumentCount);
				sinon.assert.notCalled(countDocuments);
			});


			it('Should return the totals object for one item using estimatedDocumentCount()', async () => {

				const mongodb = new MongoDB(config);

				const estimatedDocumentCount = sinon.stub().resolves(2);
				const countDocuments = sinon.stub();

				const { collection } = mockChain(true, [{ a: 1 }, { b: 2 }], { countDocuments, estimatedDocumentCount });

				const model = getModel();

				// Get to populate internal properties
				await mongodb.get(model, {
					limit: 2
				});

				const result = await mongodb.getTotals(model);

				assert.deepStrictEqual(result, {
					total: 2,
					pageSize: 2,
					pages: 1,
					page: 1
				});

				// Collection se llama una vez para el get
				sinon.assert.calledTwice(collection);
				sinon.assert.calledOnceWithExactly(estimatedDocumentCount);
				sinon.assert.notCalled(countDocuments);
			});
		});
	});

	describe('increment()', () => {

		const filters = {
			name: 'Fake'
		};

		const incrementData = {
			quantity: 1,
			total: 100
		};

		const setData = {
			userCreated: 'some-user-id'
		};

		const id = '5df0151dbc1d570011949d86';

		const response = {
			value: {
				_id: ObjectId(id),
				name: 'Fake',
				quantity: 10,
				total: 100,
				userCreated: 'some-user-id'
			}
		};

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.increment(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {
			const collection = stubMongo(false);

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.increment(getModel(null, ['name']), filters, incrementData, setData), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collection);
		});

		it('Should throw if mongodb increment method fails', async () => {

			const findOneAndUpdate = sinon.stub().rejects(new Error('findOneAndUpdate internal error'));

			const collection = stubMongo(true, { findOneAndUpdate });

			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.increment(getModel(null, ['name']), filters, incrementData, setData), {
				message: 'findOneAndUpdate internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		['indexes', 'uniqueIndexes'].forEach(indexesGetter => {

			context(`When model has ${indexesGetter} getter`, () => {

				it('Should use id as filter if it\'s passed', async () => {

					const findOneAndUpdate = sinon.stub().resolves(response);

					const collection = stubMongo(true, { findOneAndUpdate });

					const mongodb = new MongoDB(config);
					const result = await mongodb.increment(getModel(null, ['name'], indexesGetter), { id }, incrementData, setData);

					assert.deepStrictEqual(result, response.value);

					sinon.assert.calledOnceWithExactly(collection, 'myCollection');

					sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
						_id: {
							$eq: ObjectId(id)
						}
					}, {
						$set: {
							...setData,
							dateModified: sinon.match.date
						},
						$inc: incrementData
					}, { upsert: false, returnNewDocument: true });
				});

				it('Should use a unique index as filter if id is not passed', async () => {

					const findOneAndUpdate = sinon.stub().resolves(response);

					const collection = stubMongo(true, { findOneAndUpdate });

					const mongodb = new MongoDB(config);
					const result = await mongodb.increment(getModel(null, ['name'], indexesGetter), filters, incrementData, setData);

					assert.deepStrictEqual(result, response.value);

					sinon.assert.calledOnceWithExactly(collection, 'myCollection');

					sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
						name: {
							$eq: 'Fake'
						}
					}, {
						$set: {
							...setData,
							dateModified: sinon.match.date
						},
						$inc: incrementData
					}, { upsert: false, returnNewDocument: true });
				});

				it('Should use a multifield unique index as filter if id is not passed', async () => {

					const findOneAndUpdate = sinon.stub().resolves({ value: { ...response.value, code: 'fake-code' } });

					const collection = stubMongo(true, { findOneAndUpdate });

					const mongodb = new MongoDB(config);
					const result = await mongodb.increment(getModel({}, [
						['name', 'code']
					]), { ...filters, code: 'fake-code' }, incrementData, setData);

					assert.deepStrictEqual(result, { ...response.value, code: 'fake-code' });

					sinon.assert.calledOnceWithExactly(collection, 'myCollection');

					sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
						code: {
							$eq: 'fake-code'
						},
						name: {
							$eq: 'Fake'
						}
					}, {
						$set: {
							...setData,
							dateModified: sinon.match.date
						},
						$inc: incrementData
					}, { upsert: false, returnNewDocument: true });
				});

				it('Should update only with increments and dateModified if no Set Data is passed', async () => {

					const findOneAndUpdate = sinon.stub().resolves(response);

					const collection = stubMongo(true, { findOneAndUpdate });

					const mongodb = new MongoDB(config);
					const result = await mongodb.increment(getModel(null, ['name']), { id }, incrementData);

					assert.deepStrictEqual(result, response.value);

					sinon.assert.calledOnceWithExactly(collection, 'myCollection');

					sinon.assert.calledOnceWithExactly(findOneAndUpdate, {
						_id: {
							$eq: ObjectId(id)
						}
					}, {
						$set: {
							dateModified: sinon.match.date
						},
						$inc: incrementData
					}, { upsert: false, returnNewDocument: true });
				});

				it('Should throw if no unique indexes are defined', async () => {

					const findOneAndUpdate = sinon.stub().resolves(response);

					const collection = stubMongo(true, { findOneAndUpdate });

					const mongodb = new MongoDB(config);
					await assert.rejects(() => mongodb.increment(getModel({}, []), filters, incrementData, setData), {
						code: MongoDBError.codes.MODEL_EMPTY_UNIQUE_INDEXES
					});

					sinon.assert.notCalled(collection);
					sinon.assert.notCalled(findOneAndUpdate);
				});

				it('Should throw if no unique indexes can be matched', async () => {

					const findOneAndUpdate = sinon.stub().resolves(response);

					const collection = stubMongo(true, { findOneAndUpdate });

					const mongodb = new MongoDB(config);
					await assert.rejects(() => mongodb.increment(getModel({}, ['name']), { code: 'fake-code' }, incrementData, setData), {
						code: MongoDBError.codes.EMPTY_UNIQUE_INDEXES
					});

					sinon.assert.notCalled(collection);
					sinon.assert.notCalled(findOneAndUpdate);
				});

				it('Should throw if no increment data is passed', async () => {

					const findOneAndUpdate = sinon.stub();

					const collection = stubMongo(true, { findOneAndUpdate });

					const mongodb = new MongoDB(config);
					await assert.rejects(() => mongodb.increment(getModel({}, ['name']), filters, {}, setData), {
						code: MongoDBError.codes.INVALID_INCREMENT_DATA
					});

					sinon.assert.notCalled(collection);
					sinon.assert.notCalled(findOneAndUpdate);
				});

				it('Should throw if wrong increment data is passed', async () => {

					const findOneAndUpdate = sinon.stub();

					const collection = stubMongo(true, { findOneAndUpdate });

					const mongodb = new MongoDB(config);
					await assert.rejects(() => mongodb.increment(getModel({}, ['name']), filters, { quantity: '100' }, setData), {
						code: MongoDBError.codes.INVALID_INCREMENT_DATA
					});

					sinon.assert.notCalled(collection);
					sinon.assert.notCalled(findOneAndUpdate);
				});

			});
		});
	});

	describe('getIndexes()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.getIndexes(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const collectionStub = stubMongo(false);

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.getIndexes(getModel()), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collectionStub);
		});

		it('Should throw if mongodb indexes method fails', async () => {

			const indexesStub = sinon.stub().rejects(new Error('Indexes internal error'));
			const collectionStub = stubMongo(true, { indexes: indexesStub });

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.getIndexes(getModel()), {
				message: 'Indexes internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');
		});

		it('Should return the indexes from the model collection', async () => {

			const indexesStub = sinon.stub().resolves([
				{
					key: { field: 1 },
					name: 'some-index'
				},
				{
					key: { uniqueField: 1 },
					name: 'unique-index',
					unique: true
				}
			]);

			const collectionStub = stubMongo(true, { indexes: indexesStub });

			const mongodb = new MongoDB(config);
			const model = getModel();

			const result = await mongodb.getIndexes(model);

			assert.deepStrictEqual(result, [
				{
					key: { field: 1 },
					name: 'some-index'
				},
				{
					key: { uniqueField: 1 },
					name: 'unique-index',
					unique: true
				}
			]);

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');

			sinon.assert.calledOnceWithExactly(indexesStub);
		});
	});

	describe('createIndexes()', () => {

		const indexes = [
			{
				name: 'some-index',
				key: {
					field: 1
				}
			},
			{
				name: 'unique-index',
				key: {
					uniqueField: 1
				},
				unique: true
			}
		];

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.createIndexes(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {
			const collectionStub = stubMongo(false);

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.createIndexes(getModel(), indexes), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collectionStub);
		});

		it('Should throw if mongodb createIndexes method fails', async () => {

			const createIndexesStub = sinon.stub().rejects(new Error('createIndexes internal error'));
			const collectionStub = stubMongo(true, { createIndexes: createIndexesStub });

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.createIndexes(getModel(), indexes), {
				message: 'createIndexes internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');
		});

		[

			null,
			undefined,
			'not an object',
			['array'],
			{},
			{
				key: 'not an object'
			},
			{
				name: { not: 'a string' },
				key: { field: 1 }
			},
			{
				name: 'some-index',
				key: { field: 1 },
				unique: 'not a boolean'
			}

		].forEach(index => {

			it('Should throw if received indexes are invalid', async () => {

				const mongodb = new MongoDB(config);
				const model = getModel();

				await assert.rejects(() => mongodb.createIndexes(model, [index]), {
					name: 'MongoDBError',
					code: MongoDBError.codes.INVALID_INDEX
				});
			});
		});

		it('Should throw if received indexes are invalid', async () => {

			const mongodb = new MongoDB(config);
			const model = getModel();

			await assert.rejects(() => mongodb.createIndexes(model, { invalid: 'index' }));

		});

		it('Should return true if can create the indexes into the model collection successfully', async () => {

			const createIndexesStub = sinon.stub().resolves(indexes.map(({ name }) => name));
			const collectionStub = stubMongo(true, { createIndexes: createIndexesStub });

			const mongodb = new MongoDB(config);
			const model = getModel();

			const result = await mongodb.createIndexes(model, indexes);

			assert.deepStrictEqual(result, true);

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');

			sinon.assert.calledOnceWithExactly(createIndexesStub, indexes);
		});

		it('Should return false if can\'t create the indexes into the model collection', async () => {

			const createIndexesStub = sinon.stub().resolves({ ok: false });
			const collectionStub = stubMongo(true, { createIndexes: createIndexesStub });

			const mongodb = new MongoDB(config);
			const model = getModel();

			const result = await mongodb.createIndexes(model, indexes);

			assert.deepStrictEqual(result, false);

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');

			sinon.assert.calledOnceWithExactly(createIndexesStub, indexes);
		});
	});

	describe('createIndex()', () => {

		const index = {
			name: 'some-index',
			key: {
				field: 1
			}
		};

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.createIndex(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const collectionStub = stubMongo(false);

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.createIndex(getModel(), index), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collectionStub);
		});

		it('Should throw if mongodb createIndexes method fails', async () => {

			const createIndexesStub = sinon.stub().rejects(new Error('createIndexes internal error'));
			const collectionStub = stubMongo(true, { createIndexes: createIndexesStub });

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.createIndex(getModel(), index), {
				message: 'createIndexes internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');
		});

		[

			null,
			undefined,
			'not an object',
			['array'],
			{},
			{
				key: 'not an object'
			},
			{
				name: { not: 'a string' },
				key: { field: 1 }
			},
			{
				name: 'some-index',
				key: { field: 1 },
				unique: 'not a boolean'
			}

		].forEach(invalidIndex => {

			it('Should throw if received index is invalid', async () => {

				sinon.spy(MongoDB.prototype, 'createIndexes');

				const mongodb = new MongoDB(config);
				const model = getModel();

				await assert.rejects(() => mongodb.createIndex(model, invalidIndex), {
					name: 'MongoDBError',
					code: MongoDBError.codes.INVALID_INDEX
				});

				sinon.assert.calledOnceWithExactly(MongoDB.prototype.createIndexes, model, [invalidIndex]);
			});
		});

		it('Should return true if can create the index into the model collection successfully', async () => {

			sinon.stub(MongoDB.prototype, 'createIndexes')
				.resolves(true);

			const mongodb = new MongoDB(config);
			const model = getModel();

			const result = await mongodb.createIndex(model, index);

			assert.deepStrictEqual(result, true);

			sinon.assert.calledOnceWithExactly(MongoDB.prototype.createIndexes, model, [index]);
		});

		it('Should return false if can\'t create the indexes into the model collection', async () => {

			sinon.stub(MongoDB.prototype, 'createIndexes')
				.resolves(false);

			const mongodb = new MongoDB(config);
			const model = getModel();

			const result = await mongodb.createIndex(model, index);

			assert.deepStrictEqual(result, false);

			sinon.assert.calledOnceWithExactly(MongoDB.prototype.createIndexes, model, [index]);
		});
	});

	describe('dropIndex()', () => {

		const index = 'some-index';

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.dropIndex(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if connection to DB fails', async () => {

			const collectionStub = stubMongo(false);

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.dropIndex(getModel(), index), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collectionStub);
		});

		it('Should throw if mongodb dropIndex method fails', async () => {

			const dropIndexStub = sinon.stub().rejects(new Error('dropIndex internal error'));
			const collectionStub = stubMongo(true, { dropIndex: dropIndexStub });

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.dropIndex(getModel(), index), {
				message: 'dropIndex internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');
		});

		[

			null,
			undefined,
			1,
			['array'],
			{},
			{
				key: 'not an object'
			},
			{
				name: { not: 'a string' },
				key: { field: 1 }
			},
			{
				name: 'some-index',
				key: { field: 1 },
				unique: 'not a boolean'
			}

		].forEach(invalidIndex => {

			it('Should throw if received index is invalid', async () => {

				sinon.spy(MongoDB.prototype, 'createIndexes');

				const mongodb = new MongoDB(config);
				const model = getModel();

				await assert.rejects(() => mongodb.dropIndex(model, invalidIndex), {
					name: 'MongoDBError',
					code: MongoDBError.codes.INVALID_INDEX
				});
			});
		});

		it('Should return true if can drop the index from the model collection successfully', async () => {

			const dropIndexStub = sinon.stub().resolves({ ok: true });
			const collectionStub = stubMongo(true, { dropIndex: dropIndexStub });

			const mongodb = new MongoDB(config);
			const model = getModel();

			const result = await mongodb.dropIndex(model, index);

			assert.deepStrictEqual(result, true);

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');

			sinon.assert.calledOnceWithExactly(dropIndexStub, index);
		});

		it('Should return false if can\'t drop the index from the model collection', async () => {

			const dropIndexStub = sinon.stub().resolves({ ok: false });
			const collectionStub = stubMongo(true, { dropIndex: dropIndexStub });

			const mongodb = new MongoDB(config);
			const model = getModel();

			const result = await mongodb.dropIndex(model, index);

			assert.deepStrictEqual(result, false);

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');

			sinon.assert.calledOnceWithExactly(dropIndexStub, index);
		});
	});

	describe('dropIndexes()', () => {

		const indexes = ['some-index', 'other-index'];

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.dropIndexes(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should call dropIndex for each received indexName and return true when all the received indexes was dropped', async () => {

			const dropIndexStub = sinon.stub().resolves({ ok: true });
			const collectionStub = stubMongo(true, { dropIndex: dropIndexStub });

			const mongodb = new MongoDB(config);
			const model = getModel();

			const result = await mongodb.dropIndexes(model, indexes);

			assert.deepStrictEqual(result, true);

			sinon.assert.calledTwice(collectionStub);
			sinon.assert.calledWithExactly(collectionStub.getCall(1), 'myCollection');
			sinon.assert.calledWithExactly(collectionStub.getCall(0), 'myCollection');

			sinon.assert.calledTwice(dropIndexStub);

			indexes.forEach((index, i) => {
				sinon.assert.calledWithExactly(dropIndexStub.getCall(i), index);
			});
		});

		it('Should return false when some of the indexes drop operation returns false', async () => {

			const dropIndexStub = sinon.stub();

			dropIndexStub.onFirstCall()
				.resolves({ ok: false });

			dropIndexStub.onSecondCall()
				.resolves({ ok: true });

			const collectionStub = stubMongo(true, { dropIndex: dropIndexStub });

			const mongodb = new MongoDB(config);
			const model = getModel();

			const result = await mongodb.dropIndexes(model, indexes);

			assert.deepStrictEqual(result, false);

			sinon.assert.calledTwice(collectionStub);
			sinon.assert.calledWithExactly(collectionStub.getCall(1), 'myCollection');
			sinon.assert.calledWithExactly(collectionStub.getCall(0), 'myCollection');

			sinon.assert.calledTwice(dropIndexStub);

			indexes.forEach((index, i) => {
				sinon.assert.calledWithExactly(dropIndexStub.getCall(i), index);
			});
		});

		it('Should throw when the dropIndex method rejects', async () => {

			const dropIndexStub = sinon.stub().rejects();
			const collectionStub = stubMongo(true, { dropIndex: dropIndexStub });

			const mongodb = new MongoDB(config);
			const model = getModel();

			await assert.rejects(() => mongodb.dropIndexes(model, indexes));

			sinon.assert.calledTwice(collectionStub);
			sinon.assert.calledWithExactly(collectionStub.getCall(1), 'myCollection');
			sinon.assert.calledWithExactly(collectionStub.getCall(0), 'myCollection');

			sinon.assert.calledTwice(dropIndexStub);

			indexes.forEach((index, i) => {
				sinon.assert.calledWithExactly(dropIndexStub.getCall(i), index);
			});
		});

		[

			null,
			undefined,
			1,
			'not an array',
			{}

		].forEach(invalidIndexes => {

			it('Should throw if received index is invalid', async () => {

				const mongodb = new MongoDB(config);
				const model = getModel();

				await assert.rejects(() => mongodb.dropIndexes(model, invalidIndexes), {
					name: 'MongoDBError',
					code: MongoDBError.codes.INVALID_INDEX
				});
			});
		});
	});

	describe('dropDatabase()', () => {

		it('Should throw if connection to DB fails', async () => {

			stubMongo(false);

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.dropDatabase(), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});

		it('Should throw if mongodb dropDatabase method fails', async () => {

			const mongodb = new MongoDB(config);

			const dropDatabaseStub = sinon.stub().rejects(new Error('dropDatabase internal error'));

			sinon.stub(MongoWrapper.prototype, 'getDb')
				.resolves({ dropDatabase: dropDatabaseStub });

			await assert.rejects(() => mongodb.dropDatabase(), {
				message: 'dropDatabase internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(dropDatabaseStub);
		});

		it('Should return true if can drop the database when dropDatabase is called', async () => {

			const mongodb = new MongoDB(config);

			const dropDatabaseStub = sinon.stub().resolves(true);

			sinon.stub(MongoWrapper.prototype, 'getDb')
				.resolves({ dropDatabase: dropDatabaseStub });

			const result = await mongodb.dropDatabase();

			assert.deepStrictEqual(result, true);

			sinon.assert.calledOnceWithExactly(dropDatabaseStub);
		});

		it('Should return false if can\'t drop the database when dropDatabase is called', async () => {

			const mongodb = new MongoDB(config);

			const dropDatabaseStub = sinon.stub().resolves(false);

			sinon.stub(MongoWrapper.prototype, 'getDb')
				.resolves({ dropDatabase: dropDatabaseStub });

			const result = await mongodb.dropDatabase();

			assert.deepStrictEqual(result, false);

			sinon.assert.calledOnceWithExactly(dropDatabaseStub);
		});
	});

	describe('dropCollection()', () => {

		it('Should throw if connection to DB fails', async () => {

			stubMongo(false);

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.dropCollection('my-collection'), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});

		it('Should throw if mongodb dropCollection method fails', async () => {

			const mongodb = new MongoDB(config);

			const dropCollectionStub = sinon.stub().rejects(new Error('dropCollection internal error'));

			sinon.stub(MongoWrapper.prototype, 'getDb')
				.resolves({
					collection: () => ({ drop: dropCollectionStub })
				});

			await assert.rejects(() => mongodb.dropCollection('my-collection'), {
				message: 'dropCollection internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(dropCollectionStub);
		});

		it('Should return true if can drop the collection when dropCollection is called', async () => {

			const mongodb = new MongoDB(config);

			const dropCollectionStub = sinon.stub().resolves(true);

			sinon.stub(MongoWrapper.prototype, 'getDb')
				.resolves({
					collection: () => ({ drop: dropCollectionStub })
				});

			const result = await mongodb.dropCollection('my-collection');

			assert.deepStrictEqual(result, true);

			sinon.assert.calledOnceWithExactly(dropCollectionStub);
		});

		it('Should return false if can\'t drop the collection when dropCollection is called', async () => {

			const mongodb = new MongoDB(config);

			const dropCollectionStub = sinon.stub().resolves(false);

			sinon.stub(MongoWrapper.prototype, 'getDb')
				.resolves({
					collection: () => ({ drop: dropCollectionStub })
				});

			const result = await mongodb.dropCollection('my-collection');

			assert.deepStrictEqual(result, false);

			sinon.assert.calledOnceWithExactly(dropCollectionStub);
		});
	});

	describe('deleteAllDocuments()', () => {

		it('Should throw if connection to DB fails', async () => {

			stubMongo(false);

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.deleteAllDocuments('my-collection'), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});

		it('Should throw if mongodb deleteAllDocuments method fails', async () => {

			const mongodb = new MongoDB(config);

			const deleteAllDocumentsStub = sinon.stub().rejects(new Error('deleteAllDocuments internal error'));

			sinon.stub(MongoWrapper.prototype, 'getDb')
				.resolves({
					collection: () => ({ deleteMany: deleteAllDocumentsStub })
				});

			await assert.rejects(() => mongodb.deleteAllDocuments('my-collection'), {
				message: 'deleteAllDocuments internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(deleteAllDocumentsStub, {});
		});

		it('Should return the count of deleted documents if can delete collection documents when deleteAllDocuments is called', async () => {

			const mongodb = new MongoDB(config);

			const deleteAllDocumentsStub = sinon.stub().resolves({ deletedCount: 10 });

			sinon.stub(MongoWrapper.prototype, 'getDb')
				.resolves({
					collection: () => ({ deleteMany: deleteAllDocumentsStub })
				});

			const result = await mongodb.deleteAllDocuments('my-collection');

			assert.deepStrictEqual(result, 10);

			sinon.assert.calledOnceWithExactly(deleteAllDocumentsStub, {});
		});

		it('Should pass the filter for the deleteMany command when filter received', async () => {

			const mongodb = new MongoDB(config);

			const deleteAllDocumentsStub = sinon.stub().resolves({ deletedCount: 10 });

			sinon.stub(MongoWrapper.prototype, 'getDb')
				.resolves({
					collection: () => ({ deleteMany: deleteAllDocumentsStub })
				});

			const result = await mongodb.deleteAllDocuments('my-collection', { code: 2 });

			assert.deepStrictEqual(result, 10);

			sinon.assert.calledOnceWithExactly(deleteAllDocumentsStub, { code: 2 });
		});

		it('Should return 0 if can\'t delete collection documents when deleteAllDocuments is called', async () => {

			const mongodb = new MongoDB(config);

			const deleteAllDocumentsStub = sinon.stub().resolves({ deletedCount: 0 });

			sinon.stub(MongoWrapper.prototype, 'getDb')
				.resolves({
					collection: () => ({ deleteMany: deleteAllDocumentsStub })
				});

			const result = await mongodb.deleteAllDocuments('my-collection');

			assert.deepStrictEqual(result, 0);

			sinon.assert.calledOnceWithExactly(deleteAllDocumentsStub, {});
		});
	});

	describe('aggregate()', () => {

		it('Should throw if no model is passed', async () => {
			const mongodb = new MongoDB(config);
			await assert.rejects(() => mongodb.aggregate(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		const invalidStages = [
			['$unset', 'only a string'],
			[100, 'only a number'],
			[{ $unset: 'field' }, 'only an object'],
			[null, 'empty values']
		];

		invalidStages.forEach(async ([invalidStage, value]) => {

			it(`Should throw if pipe stages with ${value} are passed`, async () => {

				const mongodb = new MongoDB(config);

				await assert.rejects(() => mongodb.aggregate(getModel(), invalidStage), {
					code: MongoDBError.codes.INVALID_STAGES
				});
			});
		});

		const itemId = '5df0151dbc1d570011949d87';

		const stages = [
			{ $match: { id: itemId, referenceId: 'display-id' } },
			{ $unset: 'category' }
		];

		it('Should throw if connection to DB fails', async () => {

			const collection = stubMongo(false);

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.aggregate(getModel(), stages), {
				message: 'Error getting DB',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.notCalled(collection);
		});

		it('Should throw if mongodb aggregate method fails', async () => {

			const toArray = sinon.stub().rejects(new Error('Aggregate internal error'));
			const aggregate = sinon.stub().returns({ toArray });

			const collection = stubMongo(true, { aggregate, toArray });

			const mongodb = new MongoDB(config);

			await assert.rejects(() => mongodb.aggregate(getModel(), stages), {
				message: 'Aggregate internal error',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');
		});

		it('Should execute every pipe stage', async () => {

			const item = {
				_id: itemId,
				name: 'Some name',
				referenceId: 'display-id'
			};

			const toArray = sinon.stub().resolves([item]);
			const aggregate = sinon.stub().returns({ toArray });

			const collection = stubMongo(true, { aggregate, toArray });

			const mongodb = new MongoDB(config);
			const result = await mongodb.aggregate(getModel(), stages);

			assert.deepStrictEqual(result, [{
				id: itemId,
				name: 'Some name',
				referenceId: 'display-id'
			}]);

			sinon.assert.calledOnceWithExactly(collection, 'myCollection');

			sinon.assert.calledOnceWithExactly(aggregate, [
				{ $match: { _id: ObjectId(itemId), referenceId: 'display-id' } },
				{ $unset: 'category' }
			]);

			sinon.assert.calledOnce(toArray);
		});
	});

	describe('idStruct()', () => {

		it('Should return an idStruct function', async () => {
			const mongodb = new MongoDB(config);
			try {
				mongodb.idStruct('123');
			} catch(error) {
				assert.deepStrictEqual(error.message, 'Expected a value of type `objectId` but received `"123"`.');
			}
		});
	});
});
