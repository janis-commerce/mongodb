'use strict';

const sinon = require('sinon');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');

describe('Batch', () => {

	const now = new Date();

	before(() => {
		sinon.useFakeTimers(now);
	});

	afterEach(() => {
		getMongodbInstance().dropCollection(TestModel.table);
	});

	after(() => {
		sinon.restore();
	});

	it('multiInsert(): Should insert multiple documents and return an array of documents', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [
			{ name: 'Test 1' },
			{ name: 'Test 2' }
		]);

		const result = await getMongodbInstance().get(model, {
			filters: {
				name: 'Test 1'
			}
		});

		sinon.assert.match(result, [{
			id: sinon.match.string,
			name: 'Test 1',
			dateCreated: now
		}]);
	});

	it('multiSave(): Should save multiple documents and return an array of documents', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiSave(model, [
			{ name: 'Test 1' },
			{ name: 'Test 2' }
		]);

		const result = await getMongodbInstance().get(model, {
			filters: {
				name: 'Test 1'
			}
		});

		sinon.assert.match(result, [{
			id: sinon.match.string,
			name: 'Test 1',
			dateCreated: now,
			dateModified: sinon.match.date
		}]);
	});

	it('multiRemove(): Should remove multiple documents and return an array of documents', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [
			{ name: 'Test 1' },
			{ name: 'Test 2' },
			{ name: 'Other' }
		]);

		await mongodb.multiRemove(model, {
			name: {
				type: 'search',
				value: 'Test'
			}
		});

		const result = await getMongodbInstance().get(model, {});

		sinon.assert.match(result, [{
			id: sinon.match.string,
			name: 'Other',
			dateCreated: now
		}]);
	});

});
