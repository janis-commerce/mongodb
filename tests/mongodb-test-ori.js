'use strict';

const assert = require('assert');

const MongoDB = require('./../index');

const MongoDBError = require('./../mongodb/mongodb-error');

/* eslint-disable prefer-arrow-callback */

describe('MongoDB', function() {

	describe('getFilter', function() {

		const mongodb = new MongoDB({});

		describe('should throw', function() {

			it('when model haven\'t indexes', function() {

				class Model {
					static get table() {
						return 'table';
					}
				}

				const dummyModel = new Model();

				assert.throws(() => {
					mongodb
						.getFilter(dummyModel);
				}, MongoDBError);
			});

			it('when getting filter and no index found', function() {

				class Model {
					static get table() {
						return 'table';
					}

					static get indexes() {
						return ['foo'];
					}
				}

				const dummyModel = new Model();

				assert.throws(() => {
					mongodb
						.getFilter(dummyModel, { sarasa: 1 });
				}, MongoDBError);

			});

		});

		describe('should return filter', function() {

			it('when index as string found', function() {

				class Model {
					static get table() {
						return 'table';
					}

					static get indexes() {
						return ['foo'];
					}
				}

				const dummyModel = new Model();

				assert.deepEqual(mongodb
					.getFilter(dummyModel, { foo: 1, bar: 2 }), { foo: 1 });
			});

		});

	});

	describe('prepareFields', function() {

		/* eslint-disable no-underscore-dangle */

		it('should convert to ObjectID the field _id', function() {

			const mongodb = new MongoDB({});

			const item = {
				_id: 1,
				foo: 'bar'
			};

			mongodb.prepareFields(item);

			assert.notEqual(item._id, 1);

		});


	});

});
