'use strict';

const assert = require('node:assert').strict;

const sinon = require('sinon');

const MongoDBError = require('../../lib/mongodb-error');
const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');

/**
 * Drops the given collection (default: the shared test collection). Safe to call if it does not exist.
 * Use in afterEach/after: every fixture must leave the collection clean (and without indexes).
 *
 * @param {string} [table]
 * @returns {Promise<void>}
 */
const cleanCollection = async (table = TestModel.table) => {
	await getMongodbInstance().dropCollection(table);
};

/**
 * Asserts that the promise rejects with a MongoDBError wrapping a driver/server error.
 *
 * @param {Promise} promise
 * @param {number} serverCode Expected server error code (`previousError.code`)
 * @returns {Promise<MongoDBError>}
 */
const assertDriverError = async (promise, serverCode) => {

	let error;

	try {
		await promise;
	} catch(err) {
		error = err;
	}

	assert.ok(error, 'Expected the promise to reject');
	assert.ok(error instanceof MongoDBError, `Expected MongoDBError, got ${error?.name}: ${error?.message}`);
	assert.equal(error.code, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
	assert.equal(error.previousError?.code, serverCode);

	return error;
};

/**
 * Fakes only the client `Date`. Server-side dates (`$currentDate`) are not affected.
 *
 * @param {Date} [now]
 * @returns {import('sinon').SinonFakeTimers}
 */
const useFakeDate = (now = new Date()) => sinon.useFakeTimers({ now, toFake: ['Date'] });

/**
 * Creates a TestModel subclass (same table) with the given `fields` definition
 *
 * @param {object} fields The model fields
 * @returns {typeof TestModel}
 */
const createModelWithFields = fields => class ModelWithCustomFields extends TestModel {

	static get fields() {
		return fields;
	}

};

/**
 * Reads the documents as stored in the collection (raw driver documents: `_id` is not mapped to `id`)
 *
 * @param {object} model Model instance
 * @param {object} [filter]
 * @returns {Promise<Array<object>>}
 */
const findRaw = (model, filter = {}) => getMongodbInstance().mongo.makeQuery(model, collection => collection.find(filter).toArray());

module.exports = {
	createModelWithFields,
	findRaw,
	cleanCollection,
	assertDriverError,
	useFakeDate
};
