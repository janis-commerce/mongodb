'use strict';

// Clear node require caches
Object.keys(require.cache).forEach(key => { delete require.cache[key]; });

const assert = require('assert');
const sandbox = require('sinon').createSandbox();
const { MongoClient, ObjectID } = require('mongodb');

sandbox.stub(MongoClient, 'connect');

const MongoDB = require('./../../lib/mongodb');
const MongoDBError = require('./../../lib/mongodb-error');

const MongoDBFilterWrapper = require('../../lib/mongodb-filter-wrapper');

class Model {

	static get uniqueIndexes() {
		return [
			'id',
			'unique'
		];
	}

	static get indexes() {
		return [
			'value'
		];
	}

	static get table() {
		return 'table';
	}

	static get fields() {
		return {
			dateFrom: {
				type: 'greaterOrEqual',
				field: 'date'
			},
			dateFrom2: {
				type: 'greater',
				field: 'date'
			},
			dateTo: {
				type: 'lesserOrEqual',
				field: 'date'
			},
			dateTo2: {
				type: 'lesser',
				field: 'date'
			},
			storeDist: {
				type: 'notEqual',
				field: 'store'
			},
			someId: {
				isID: true
			},
			fieldWithInvalidFilterType: {
				type: 'invalid'
			}
		};
	}

}


const mongodb = new MongoDB({
	host: 'localhost',
	port: 27017,
	database: 'myDB'
});

const model = new Model();
class Collection {

	find() {}

	sort() {}

	skip() {}

	limit() {}

	toArray() {}
}

describe('MongoDBFilterWrapper', () => {

	describe('Using only FilterWrapper', () => {

		it('Should returns an empty filter when dont define any filter by param', async () => {
			assert.deepStrictEqual(MongoDBFilterWrapper.getParsedFilters({}, model), {});
		});
	});

	let collectionStub = sandbox.stub(Collection.prototype);
	const response = {
		_id: 'ObjectID(000000016087bb2baab4e26b)',
		store: 'Janis',
		gain: 10,
		bla: 'foo',
		dateCreated: {}
	};
	collectionStub.find.returnsThis();
	collectionStub.sort.returnsThis();
	collectionStub.skip.returnsThis();
	collectionStub.limit.returnsThis();
	collectionStub.toArray.resolves([]);

	beforeEach(() => {

		const db = () => ({ collection: sandbox.fake.returns(collectionStub) });
		MongoClient.connect = () => ({ db });

	});

	afterEach(() => {
		sandbox.restore();
		collectionStub = sandbox.stub(Collection.prototype);
		collectionStub.find.returnsThis();
		collectionStub.sort.returnsThis();
		collectionStub.skip.returnsThis();
		collectionStub.limit.returnsThis();
		collectionStub.toArray.resolves([]);
	});


	describe('Using FilterWrapper with filters', () => {

		it('Should throw if an invalid filter type is passed', async () => {
			await assert.rejects(mongodb.get(model, { filters: { fieldWithInvalidFilterType: 'foo' } }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_FILTER_TYPE
			});
		});

		it('Should get an equal/in value if isn\'t defined type for single/multiple values', async () => {
			collectionStub.toArray.returns([response]);
			const item = await mongodb.get(model, { filters: { bla: 'foo', gain: [9, 10] } });
			assert.deepStrictEqual(item[0], response);

			sandbox.assert.calledWithExactly(collectionStub.find, {
				bla: {
					$eq: 'foo'
				},
				gain: {
					$in: [9, 10]
				}
			});
		});

		it('Should filter by an ObjectID if field isID', async () => {
			collectionStub.toArray.returns([response]);
			await mongodb.get(model, { filters: { someId: '5de9568c47a18000122caf27' } });

			sandbox.assert.calledWithExactly(collectionStub.find, {
				someId: {
					$eq: ObjectID('5de9568c47a18000122caf27')
				}
			});
		});

		it('Should filter by an ObjectID if field isID with multiple values', async () => {
			collectionStub.toArray.returns([response]);
			await mongodb.get(model, { filters: { someId: ['5de9568c47a18000122caf27', '5de9568c47a18000122caf28'] } });

			sandbox.assert.calledWithExactly(collectionStub.find, {
				someId: {
					$in: [
						ObjectID('5de9568c47a18000122caf27'),
						ObjectID('5de9568c47a18000122caf28')
					]
				}
			});
		});

		it('Should get a value if is not defined a filter', async () => {
			collectionStub.toArray.returns([response]);
			const item = await mongodb.get(model, { });
			assert.deepStrictEqual(item[0], response);

			sandbox.assert.calledWithExactly(collectionStub.find, { });
		});

		it('Should get an or filter if defined by an array', async () => {
			// Insert
			const resultOr = {
				id: 1,
				store: 'Janis',
				gain: 10,
				bla: 'foo'
			};

			const filterOr = [
				{
					store: {
						value: 'Janis',
						type: 'notEqual'
					},
					bla: 'afoo'
				},
				{
					gain: 10
				}
			];

			collectionStub.toArray.returns([resultOr]);

			const item = await mongodb.get(model, {
				filters: filterOr
			});
			assert.deepStrictEqual(item[0], resultOr);

			sandbox.assert.calledWithExactly(collectionStub.find, {
				$or: [
					{
						bla: {
							$eq: 'afoo'
						},
						store: {
							$ne: 'Janis'
						}
					},
					{
						gain: {
							$eq: 10
						}
					}
				]
			});
		});

		it('Should get an gte date if isnt defined type', async () => {
			const resultGte = { id: 1, date: '2000-01-03' };
			collectionStub.toArray.returns([resultGte]);
			const item = await mongodb.get(model, { filters: { dateFrom: '2000-01-01' } });
			assert.deepStrictEqual(item[0], resultGte);
			sandbox.assert.calledWithExactly(collectionStub.find, { date: { $gte: '2000-01-01' } });
		});

		it('Should get an gt date if define a field with that filter', async () => {
			// Insert
			const resultGt = [{ id: 1, date: '2000-01-02' }, { id: 2, date: '2000-01-03' }];
			collectionStub.toArray.returns(resultGt);
			const item = await mongodb.get(model, { filters: { dateFrom2: '2000-01-01' } });
			assert.deepStrictEqual(item, resultGt);
			sandbox.assert.calledWithExactly(collectionStub.find, { date: { $gt: '2000-01-01' } });
		});

		it('Should get an lte filter if is defined that filter', async () => {
			const resultLte = { id: 1, date: '2000-01-25' };
			collectionStub.toArray.returns([resultLte]);
			const item = await mongodb.get(model, { filters: { dateTo: '2000-01-25' } });
			assert.deepStrictEqual(item[0], resultLte);
			sandbox.assert.calledWithExactly(collectionStub.find, { date: { $lte: '2000-01-25' } });
		});

		it('Should get an lt date if is defined that filter', async () => {
			const resultLt = { id: 1, date: '2000-01-25' };
			collectionStub.toArray.returns([resultLt]);
			const item = await mongodb.get(model, { filters: { dateTo2: '2000-01-25' } });
			assert.deepStrictEqual(item[0], resultLt);
			sandbox.assert.calledWithExactly(collectionStub.find, { date: { $lt: '2000-01-25' } });
		});

		it('Should get a value if filter is distinct', async () => {
			const resultDist = { id: 1, store: 'ASTORE' };
			collectionStub.toArray.returns([resultDist]);
			const item = await mongodb.get(model, { filters: { storeDist: 'JBA1' } });
			assert.deepStrictEqual(item[0], resultDist);
			sandbox.assert.calledWithExactly(collectionStub.find, { store: { $ne: 'JBA1' } });
		});

		it('Should get an gte filter if isnt defined type', async () => {
			// Insert
			const resultLte = [{ id: 1, date: '2000-01-02', store: 'AAA' }, { id: 2, date: '2000-01-05', store: 'AAA' }];
			collectionStub.toArray.returns(resultLte);
			const item = await mongodb.get(model, { filters: { date: { value: '2000-01-10', type: 'lesser' }, store: 'AAA' } });
			assert.deepStrictEqual(item, resultLte);
			sandbox.assert.calledWithExactly(collectionStub.find, { date: { $lt: '2000-01-10' }, store: { $eq: 'AAA' } });
		});

		it('Should get an or filter if define a array', async () => {
			const resultOrFilter = [{ id: 1, store: 'save_test_data' }, { id: 3, store: 'foo_value' }];
			collectionStub.toArray.returns(resultOrFilter);
			const item = await mongodb.get(model, { filters: [{ store: 'save_test_data' }, { store: { value: 'foo_value', type: 'equal' } }] });
			assert.deepStrictEqual(item, resultOrFilter);
			sandbox.assert.calledWithExactly(collectionStub.find, { $or: [{ store: { $eq: 'save_test_data' } }, { store: { $eq: 'foo_value' } }] });
		});

		it('Should get values with an in filter if define a array to search', async () => {
			// Insert
			const resultIn = [{ id: 1, store: 'save_test_data' }, { id: 3, store: 'foo_value' }];
			collectionStub.toArray.returns(resultIn);
			const item = await mongodb.get(model, { filters: { store: { value: ['save_test_data', 'foo_value'], type: 'in' } } });
			assert.deepStrictEqual(item, resultIn);
			sandbox.assert.calledWithExactly(collectionStub.find, { store: { $in: ['save_test_data', 'foo_value'] } });
		});

		it('Should get values with a not in filter if define a array to search', async () => {
			const resultNotIn = { id: 2, store: 'only_for_test' };
			collectionStub.toArray.returns([resultNotIn]);
			const item = await mongodb.get(model, { filters: { store: { value: ['save_test_data', 'foo_value'], type: 'notIn' } } });
			assert.deepStrictEqual(item[0], resultNotIn);
			sandbox.assert.calledWithExactly(collectionStub.find, { store: { $nin: ['save_test_data', 'foo_value'] } });
		});

		it('Should get all values in a filter if define a array to search', async () => {
			const resultAll = { id: 1, store: ['save_test_data', 'blabla'] };
			collectionStub.toArray.returns([resultAll]);
			const item = await mongodb.get(model, { filters: { store: { value: ['save_test_data', 'blabla'], type: 'all' } } });
			assert.deepStrictEqual(item[0], resultAll);
			sandbox.assert.calledWithExactly(collectionStub.find, { store: { $all: ['save_test_data', 'blabla'] } });
		});

		it('Should get all values that accomplish one value of filter if define a array to search', async () => {
			const resultIn = [{ id: 1, store: ['save_test_data', 'blabla'] }, { id: 2, store: ['blabla', 'new_foo_value'] }];
			collectionStub.toArray.returns(resultIn);
			const item = await mongodb.get(model, { filters: { store: { value: ['blabla'], type: 'in' } } });
			assert.deepStrictEqual(item.length, 2);
			sandbox.assert.calledWithExactly(collectionStub.find, { store: { $in: ['blabla'] } });
		});

		it('Should get between values that accomplish the two filters if define as an and', async () => {
			const resultIn = [{ id: 1, store: 'blabla', date: '2019-07-20' }, { id: 2, date: '2019-08-20', store: 'blabla' }];
			collectionStub.toArray.returns(resultIn);
			const item = await mongodb.get(model, { filters: { dateFrom: '2019-08-10', dateTo: '2019-09-09' } });
			assert.deepStrictEqual(item.length, 2);
			sandbox.assert.calledWithExactly(collectionStub.find, { date: { $lte: '2019-09-09', $gte: '2019-08-10' } });
		});

		it('Should filter by dates in ISO format', async () => {
			const resultIn = [{ id: 1, store: 'blabla', date: new Date('2019-07-20') }, { id: 2, date: new Date('2019-08-20'), store: 'blabla' }];
			collectionStub.toArray.returns(resultIn);
			const item = await mongodb.get(model, { filters: { dateFrom: new Date('2019-08-10'), dateTo: new Date('2019-09-09') } });
			assert.deepStrictEqual(item.length, 2);
			sandbox.assert.calledWithExactly(collectionStub.find, { date: { $gte: '2019-08-10T00:00:00.000Z', $lte: '2019-09-09T00:00:00.000Z' } });
		});
	});
});
