'use strict';

/* eslint-disable no-unused-vars */

const assert = require('assert');
const sinon = require('sinon');

const { MongoClient, ObjectID } = require('mongodb');

const { MongoDB, MongoDBError } = require('./../mongodb');

/* eslint-disable prefer-arrow-callback */

describe('MongoDB', function() {

	let dummyModel;
	let fullTableName;

	const mongodb = new MongoDB({});

	class Model {
		getTable() {
			return 'table';
		}
	}

	before(() => {
		dummyModel = new Model();
		dummyModel.dbname = 'dbname';
		fullTableName = `${dummyModel.dbname}.${dummyModel.getTable()}`;
	});

	describe('handled errors', function() {

		describe('getFilter()', function() {

			
		});
	});

	describe('checkConnection()', function() {

		const stubExecute = result => sinon.stub(MongoClient.prototype, 'connect').callsFake(() => result);

		it('should explode 😃🔥', async function() {

			await assert.rejects(mongodb.checkConnection());

		});

		it('should not explode 🚫🔥', async function() {

			const stub = stubExecute(
				Promise.resolve()
			);

			await assert.doesNotReject(mongodb.checkConnection());

			stub.restore();
		});
	});

});
