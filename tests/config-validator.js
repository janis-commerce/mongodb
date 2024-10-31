'use strict';

const assert = require('assert');

const ConfigValidator = require('../lib/config-validator');

describe('ConfigValidator - validate()', () => {

	const validConfig = {
		protocol: 'mongodb://',
		host: 'localhost',
		port: 27017,
		user: '',
		password: '',
		database: 'myDb',
		limit: 500
	};

	it('Should throw if config is empty', () => {
		assert.throws(() => ConfigValidator.validate());
	});

	it('Should throw if config is not an object', () => {
		assert.throws(() => ConfigValidator.validate('invalid'));
		assert.throws(() => ConfigValidator.validate(10));
		assert.throws(() => ConfigValidator.validate([]));
	});

	it('Should throw if protocol config is not a string', () => {
		assert.throws(() => ConfigValidator.validate({
			...validConfig,
			protocol: ['invalid']
		}));
	});

	it('Should throw if host config is not a string', () => {
		assert.throws(() => ConfigValidator.validate({
			...validConfig,
			host: ['invalid']
		}));
	});

	it('Should throw if port config is not a number', () => {
		assert.throws(() => ConfigValidator.validate({
			...validConfig,
			port: ['invalid']
		}));
	});

	it('Should throw if user config is not a string', () => {
		assert.throws(() => ConfigValidator.validate({
			...validConfig,
			user: ['invalid']
		}));
	});

	it('Should throw if password config is not a string', () => {
		assert.throws(() => ConfigValidator.validate({
			...validConfig,
			password: ['invalid']
		}));
	});

	it('Should throw if limit config is not a number', () => {
		assert.throws(() => ConfigValidator.validate({
			...validConfig,
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

	it('Should avoid protocol duplication', () => {

		const fullConfig = {
			...validConfig,
			protocol: 'mongodb+srv://',
			host: 'mongodb+srv://some.host'
		};

		const finalConfig = ConfigValidator.validate({ ...fullConfig });

		assert.deepStrictEqual(finalConfig.host, 'some.host');
	});

	it('Should avoid writeConcern duplication when received as only parameter', () => {

		const fullConfig = {
			...validConfig,
			host: 'some.host?w=majority'
		};

		const finalConfig = ConfigValidator.validate({ ...fullConfig });

		assert.deepStrictEqual(finalConfig.host, 'some.host');
	});

	it('Should avoid writeConcern duplication when received as first parameter', () => {

		const fullConfig = {
			...validConfig,
			host: 'some.host?w=majority&retryWrites=true'
		};

		const finalConfig = ConfigValidator.validate({ ...fullConfig });

		assert.deepStrictEqual(finalConfig.host, 'some.host?retryWrites=true');
	});

	it('Should avoid writeConcern duplication when received as last parameter', () => {

		const fullConfig = {
			...validConfig,
			host: 'some.host?retryWrites=true&w=majority'
		};

		const finalConfig = ConfigValidator.validate({ ...fullConfig });

		assert.deepStrictEqual(finalConfig.host, 'some.host?retryWrites=true');
	});

	it('Should allow to config with connectionString instead of all parameters', () => {

		assert.doesNotThrow(() => ConfigValidator.validate({
			connectionString: 'mongodb://the-host.bv8jk.mongodb.net/?authSource=%24external&authMechanism=MONGODB-AWS&retryWrites=true&w=majority'
		}));
	});
});
