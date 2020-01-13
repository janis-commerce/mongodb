'use strict';

const assert = require('assert');

const ConfigValidator = require('../lib/config-validator');

describe('ConfigValidator', () => {

	describe('validate()', () => {

		it('Should throw if config is empty', () => {
			assert.throws(() => ConfigValidator.validate());
		});

		it('Should throw if config is not an object', () => {
			assert.throws(() => ConfigValidator.validate('invalid'));
			assert.throws(() => ConfigValidator.validate(10));
			assert.throws(() => ConfigValidator.validate([]));
		});

		it('Should throw if database config is not defined', () => {
			assert.throws(() => ConfigValidator.validate({
				protocol: 'mongodb://',
				host: 'localhost',
				port: 27017,
				user: '',
				password: '',
				limit: 500
			}));
		});

		it('Should throw if protocol config is not a string', () => {
			assert.throws(() => ConfigValidator.validate({
				protocol: ['invalid'],
				host: 'localhost',
				port: 27017,
				user: '',
				password: '',
				database: 'myDb',
				limit: 500
			}));
		});

		it('Should throw if host config is not a string', () => {
			assert.throws(() => ConfigValidator.validate({
				protocol: 'mongodb://',
				host: ['invalid'],
				port: 27017,
				user: '',
				password: '',
				database: 'myDb',
				limit: 500
			}));
		});

		it('Should throw if port config is not a number', () => {
			assert.throws(() => ConfigValidator.validate({
				protocol: 'mongodb://',
				host: 'localhost',
				port: ['invalid'],
				user: '',
				password: '',
				database: 'myDb',
				limit: 500
			}));
		});

		it('Should throw if user config is not a string', () => {
			assert.throws(() => ConfigValidator.validate({
				protocol: 'mongodb://',
				host: 'localhost',
				port: 27017,
				user: ['invalid'],
				password: '',
				database: 'myDb',
				limit: 500
			}));
		});

		it('Should throw if password config is not a string', () => {
			assert.throws(() => ConfigValidator.validate({
				protocol: 'mongodb://',
				host: 'localhost',
				port: 27017,
				user: '',
				password: ['invalid'],
				database: 'myDb',
				limit: 500
			}));
		});

		it('Should throw if limit config is not a number', () => {
			assert.throws(() => ConfigValidator.validate({
				protocol: 'mongodb://',
				host: 'localhost',
				port: 27017,
				user: '',
				password: '',
				database: 'myDb',
				limit: ['invalid']
			}));
		});

		it('Should pass with minimal configuration, adding defaults', () => {
			const finalConfig = ConfigValidator.validate({
				database: 'myDb'
			});

			assert.deepStrictEqual(finalConfig, {
				protocol: 'mongodb://',
				host: 'localhost',
				port: 27017,
				user: '',
				password: '',
				database: 'myDb',
				limit: 500
			});
		});

		it('Should pass with every config set properly', () => {

			const fullConfig = {
				protocol: 'mongodb+srv://',
				host: 'some.host',
				port: 270170,
				user: 'user',
				password: 'pwd',
				database: 'myDb',
				limit: 200
			};

			const finalConfig = ConfigValidator.validate({ ...fullConfig });

			assert.deepStrictEqual(finalConfig, fullConfig);
		});

	});

});
