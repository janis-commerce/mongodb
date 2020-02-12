'use strict';

const assert = require('assert');
const sinon = require('sinon');
const DateToString = require('../../../lib/helpers/functions-types/date-to-string');

describe('DateToString', () => {

	afterEach(() => {
		sinon.restore();
	});

	describe('transform()', () => {
		it('Should return a dateToString mongodb query', () => {
			const result = DateToString.transform('test', { format: '' });
			assert.equal(result.key, 'test');
			assert.equal(result.value.$dateToString.date, '$test');
		});

		it('Should use specified filter value instead fieldkey for match database field name', () => {
			const result = DateToString.transform('test', { format: '', value: 'dbFieldName' });
			assert.equal(result.key, 'test');
			assert.equal(result.value.$dateToString.date, '$dbFieldName');
		});
	});

	describe('validate()', () => {
		it('Should throw an error when fieldValue is undefined', () => {
			assert.throws(() => DateToString.validate('test'), {
				message: 'test must have a valid format property'
			});
		});

		it('Should throw an error when fieldVaue format field is undefined', () => {
			assert.throws(() => DateToString.validate('test', {}), {
				message: 'test must have a valid format property'
			});
		});

		it('Should pass without errors', () => {
			assert.ok(DateToString.validate('test', { format: '%%' }));
		});

	});

});
