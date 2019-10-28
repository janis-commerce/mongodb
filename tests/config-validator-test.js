'use strict';

const assert = require('assert');

const ConfigValidator = require('./../lib/config-validator');

const MongoDBConfigError = require('./../lib/mongodb-config-error');

describe('ConfigValidator', () => {

	describe('validate()', () => {

		it('should throw invalid config when the config is empty', () => {

			assert.throws(() => ConfigValidator.validate(), {
				name: 'MongoDBConfigError',
				code: MongoDBConfigError.codes.INVALID_CONFIG
			});

		});


		it('should throw invalid config when the config is not an object', () => {

			assert.throws(() => ConfigValidator.validate('string'), {
				name: 'MongoDBConfigError',
				code: MongoDBConfigError.codes.INVALID_CONFIG
			});

		});


		it('should throw invalid config when the config is an array', () => {

			assert.throws(() => ConfigValidator.validate([]), {
				name: 'MongoDBConfigError',
				code: MongoDBConfigError.codes.INVALID_CONFIG
			});

		});

		it('should throw required setting when a required setting is missing', () => {

			assert.throws(() => ConfigValidator.validate({}), {
				name: 'MongoDBConfigError',
				code: MongoDBConfigError.codes.REQUIRED_SETTING
			});

		});


		['string', ['array']].forEach(type => {

			it('should throw invalid setting when a setting has an unexpected type', () => {

				assert.throws(() => ConfigValidator.validate({
					database: 'myDB',
					port: type
				}), {
					name: 'MongoDBConfigError',
					code: MongoDBConfigError.codes.INVALID_SETTING
				});
			});

		});

		it('should not throw when the settings are correct', () => {

			assert.doesNotThrow(() => ConfigValidator.validate({
				database: 'myDB',
				port: 27017
			}));
		});
	});
});
