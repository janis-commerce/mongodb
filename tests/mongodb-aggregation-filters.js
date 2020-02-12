'use strict';

const assert = require('assert');
const sinon = require('sinon');
const MongoDBAggregationFilters = require('../lib/mongodb-aggregation-filters');
const FunctionTypes = require('../lib/helpers/functions-types');
const MongoDBFilters = require('../lib/mongodb-filters');

describe('MongoDBAggregationFilters', () => {

	afterEach(() => {
		sinon.restore();
	});

	describe('getFilterValue()', () => {

		it('Should call the super class filters and return with $ added on first character', () => {
			const result = MongoDBAggregationFilters.getFilterValue({ value: 'test' }, {});
			assert.deepEqual(result, '$test');
		});

	});

	describe('filterTypes()', () => {
		it('Should return filter types object', () => {
			assert.ok(typeof MongoDBAggregationFilters.filterTypes === 'object');
		});
	});

	describe('parseFilterGroupItem()', () => {
		it('Should call superclass method when filter data type is not a mongo function', () => {
			const fnStub = sinon.stub(MongoDBFilters, 'parseFilterGroupItem').returns({ filterKey: '', filterValue: '' });
			MongoDBAggregationFilters.parseFilterGroupItem(['', { type: '' }], {});
			sinon.assert.calledOnce(fnStub);
		});

		it('Should call parse filter when filter data type is a mongo function', () => {
			const fnStub = sinon.stub(MongoDBAggregationFilters, '_parseWithFunctionClass').returns({ filterKey: '', filterValue: '' });
			MongoDBAggregationFilters.parseFilterGroupItem(['test', { type: 'dateToString' }], {});
			sinon.assert.calledOnce(fnStub);
		});
	});

	describe('_parseWithFunctionClass()', () => {

		it('Should throw an error when filter name is undefined', () => {
			// eslint-disable-next-line no-underscore-dangle
			assert.throws(() => MongoDBAggregationFilters._parseWithFunctionClass(), {
				message: 'Filter name is required'
			});
		});

		it('Should throw an error when filter data type is invalid', () => {
			// eslint-disable-next-line no-underscore-dangle
			assert.throws(() => MongoDBAggregationFilters._parseWithFunctionClass('test', {}), {
				message: 'Filter type is required'
			});
		});

		it('Should throw an error when function class is not child of MongoDBFilterFunction', () => {
			// eslint-disable-next-line no-underscore-dangle
			assert.throws(() => MongoDBAggregationFilters._parseWithFunctionClass('test', { type: 'testType' }), {
				message: 'testType must inherit from FunctionAsFilter class'
			});
		});

		it('Should return parsed filter', () => {

			const parseResult = { key: 'test', value: 'value' };
			const expected = { filterKey: parseResult.key, filterValue: parseResult.value };
			const fnClass = FunctionTypes.dateToString;
			sinon.stub(fnClass, 'parse').returns(parseResult);

			// eslint-disable-next-line no-underscore-dangle
			const result = MongoDBAggregationFilters._parseWithFunctionClass('test', { type: 'dateToString' }, fnClass);
			assert.deepEqual(result, expected);
		});


	});

});
