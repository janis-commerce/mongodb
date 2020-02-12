'use strict';

const assert = require('assert');
const sinon = require('sinon');
const MongoDBAggregate = require('../lib/mongodb-aggregate');
const MongoDBAggregationFilters = require('../lib/mongodb-aggregation-filters');
const MongoDBFilters = require('../lib/mongodb-filters');

describe('MongoDBAggregate', () => {

	afterEach(() => {
		sinon.restore();
	});


	describe('pipeline()', () => {

		it('Should return a pipeline array', async () => {
			const mongoAggregate = new MongoDBAggregate();
			assert.ok(Array.isArray(mongoAggregate.pipeline));
		});

	});

	describe('group()', () => {

		it('Should throw an error when exists a member inside "fields" called "values"', async () => {
			const mongoAggregate = new MongoDBAggregate();
			assert.throws(() => mongoAggregate.group({ values: {} }), {
				message: '"values" field name in "fields" is reserved word'
			});
		});

		it('Should insert a group function inside internal pipeline', async () => {
			const fields = { test: '$test' };
			const by = null;
			const groupTest = { $group: { _id: null, test: '$test' } };

			sinon.stub(MongoDBAggregate.prototype, '_makeGroupFields').returns(fields);
			sinon.stub(MongoDBAggregate.prototype, '_makeGroupBy').returns(by);

			const mongoAggregate = new MongoDBAggregate();
			mongoAggregate.group(fields, by);

			assert.deepEqual(mongoAggregate.pipeline.shift(), groupTest);
		});

		it('Should return an instance of himself', async () => {
			sinon.stub(MongoDBAggregate.prototype, '_makeGroupFields').returns({});
			sinon.stub(MongoDBAggregate.prototype, '_makeGroupBy').returns({});

			const mongoAggregate = new MongoDBAggregate();
			const result = mongoAggregate.group({}, {});

			assert.ok(result instanceof MongoDBAggregate);
		});

	});

	describe('_makeGroupFields()', () => {

		it('Should return the default query for all element selection when param is not an object', async () => {
			const expected = { values: { $push: '$$ROOT' } };
			const mongoAggregate = new MongoDBAggregate();
			// eslint-disable-next-line no-underscore-dangle
			const result = mongoAggregate._makeGroupFields();

			assert.deepEqual(result, expected);
		});

		it('Should return parsed field filters for selection', async () => {
			const expected = {};
			const mongoAggregate = new MongoDBAggregate();

			sinon.stub(MongoDBAggregationFilters, 'parseFilters').returns(expected);

			// eslint-disable-next-line no-underscore-dangle
			const result = mongoAggregate._makeGroupFields({ test: 'test' });

			assert.deepEqual(result, expected);
		});

	});

	describe('_makeGroupBy()', () => {

		it('Should return null if param is not an array', async () => {
			const mongoAggregate = new MongoDBAggregate();
			// eslint-disable-next-line no-underscore-dangle
			const result = mongoAggregate._makeGroupBy();

			assert.deepEqual(result, null);
		});

		it('Should return an object of reduced array param with procesed filters', async () => {
			const parseFilters = { testTwo: 'mytest' };
			sinon.stub(MongoDBAggregationFilters, 'parseFilters').returns(parseFilters);
			const mongoAggregate = new MongoDBAggregate();
			// eslint-disable-next-line no-underscore-dangle
			const result = mongoAggregate._makeGroupBy(['test', parseFilters]);

			assert.deepEqual(result, { test: '$test', ...parseFilters });
		});

	});

	describe('limit()', () => {
		it('Should return a instance of himself when param is undefined or 0', async () => {
			const mongoAggregate = new MongoDBAggregate();
			// eslint-disable-next-line no-underscore-dangle
			const result = mongoAggregate.limit();

			assert.ok(result instanceof MongoDBAggregate);
		});

		it('Should insert a limit query on internal pipeline', async () => {
			const mongoAggregate = new MongoDBAggregate();
			// eslint-disable-next-line no-underscore-dangle
			const result = mongoAggregate.limit(1);

			assert.deepEqual(result.pipeline.shift(), { $limit: 1 });
		});
	});

	describe('having()', () => {

		it('Should return a instance of himself when param is undefined', async () => {
			const mongoAggregate = new MongoDBAggregate();
			// eslint-disable-next-line no-underscore-dangle
			const result = mongoAggregate.having();

			assert.ok(result instanceof MongoDBAggregate);
		});

		it('Should insert a having query when grouped by specified fields on internal pipeline', async () => {
			const parsedFilters = { myHaving: { $eq: 1 } };
			const expected = { $match: { ...parsedFilters } };

			sinon.stub(MongoDBFilters, 'parseFilters').returns(parsedFilters);

			const mongoAggregate = new MongoDBAggregate();
			const having = { myHaving: { type: 'equal', value: 1 } };

			// eslint-disable-next-line no-underscore-dangle
			const result = mongoAggregate.having(having);

			assert.deepEqual(result.pipeline.shift(), expected);
		});

		it('Should insert a having query when grouped by all fields on internal pipeline', async () => {
			const parsedFilters = { myHaving: { $eq: 1 } };
			const expected = { $match: { values: { $elemMatch: { ...parsedFilters } } } };

			sinon.stub(MongoDBFilters, 'parseFilters').returns(parsedFilters);

			const mongoAggregate = new MongoDBAggregate();
			const having = { myHaving: { type: 'equal', value: 1 } };

			// eslint-disable-next-line no-underscore-dangle
			mongoAggregate._pipeline.push({ $group: { _id: null, values: {} } });

			// eslint-disable-next-line no-underscore-dangle
			const result = mongoAggregate.having(having);

			assert.deepEqual(result.pipeline[1], expected);
		});

	});

	describe('_makeHavingQuery()', () => {});

});
