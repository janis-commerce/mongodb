'use strict';

const assert = require('assert');
const sinon = require('sinon');
const FunctionAsFilter = require('../../../lib/helpers/functions-types/function-as-filter');

describe('FunctionAsFilter', () => {

	afterEach(() => {
		sinon.restore();
	});

	describe('parse()', () => {

		it('Should validate the data, transform the data and return the parsed object', () => {
			const expected = { key: '', value: '' };
			const transform = sinon.stub(FunctionAsFilter, 'transform').returns(expected);
			const validate = sinon.stub(FunctionAsFilter, 'validate').returns(true);
			const result = FunctionAsFilter.parse('test', {});
			assert.deepEqual(result, expected);
			sinon.assert.calledOnce(transform);
			sinon.assert.calledOnce(validate);
		});

	});

	describe('transform()', () => {
		it('Should return an object with key and value', () => {
			const result = FunctionAsFilter.transform('test', {});
			assert.ok(result.key && result.value);
		});
	});

	describe('_validate()', () => {
		it('Should throw an error when fieldKey is undefined', () => {
			// eslint-disable-next-line no-underscore-dangle
			assert.throws(() => FunctionAsFilter._validate(null), Error, 'fieldKey is required');
		});

		it('Should throw an error when fieldValue is invalid', () => {
			// eslint-disable-next-line no-underscore-dangle
			assert.throws(() => FunctionAsFilter._validate('test'), Error, '"test has not a valid value');
		});

		it('Should call validate() and return ok when nothing throws an error', () => {
			const fnCall = sinon.stub(FunctionAsFilter, 'validate').returns('');
			// eslint-disable-next-line no-underscore-dangle
			assert.ok(FunctionAsFilter._validate('test', { value: '' }));
			sinon.assert.calledOnce(fnCall);
		});
	});

	describe('validate()', () => {
		it('Should exists only for subclasess', () => {
			assert.ok(FunctionAsFilter.validate());
		});
	});

});
