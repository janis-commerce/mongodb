'use strict';

const assert = require('assert');
const sinon = require('sinon');
const DateFromString = require('../../../lib/helpers/functions-types/date-from-string');

describe('DateFromString', () => {

	afterEach(() => {
		sinon.restore();
	});

	describe('transform()', () => {

		it('Should use specified filter value instead fieldkey for match database field name', () => {
			const result = DateFromString.transform('test', { format: '', value: 'dbFieldName' });
			assert.equal(result.key, 'test');
			assert.equal(result.value.$dateFromString.dateString, '$dbFieldName');
		});

		it('Should insert format if exists in fieldValue', () => {
			const result = DateFromString.transform('test', { format: 'format', value: 'dbFieldName' });
			assert.equal(result.key, 'test');
			assert.equal(result.value.$dateFromString.format, 'format');
		});

		it('Should insert timezone if exists in fieldValue', () => {
			const result = DateFromString.transform('test', { timezone: 'timezone' });
			assert.equal(result.key, 'test');
			assert.equal(result.value.$dateFromString.timezone, 'timezone');
		});
	});

});
