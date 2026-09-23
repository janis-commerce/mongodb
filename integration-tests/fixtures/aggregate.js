'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');

const TOTAL_DOCUMENTS = 1500;

describe('Aggregate and paging', () => {

	before(async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const items = Array.from({ length: TOTAL_DOCUMENTS }, (documentValue, index) => ({ name: `Item ${index}` }));

		await mongodb.multiInsert(model, items);
	});

	after(async () => {
		await getMongodbInstance().dropCollection(TestModel.table);
	});

	it('aggregate(): Should return every document even when there are more than the driver default batchSize', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const result = await mongodb.aggregate(model, [{ $match: {} }]);

		assert.equal(result.length, TOTAL_DOCUMENTS);
	});

	it('getPaged(): Should call the callback with every page when limit is lower than the total amount of documents', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const pageSize = 500;

		const receivedPages = [];

		const { total, pages, batchSize } = await mongodb.getPaged(model, { limit: pageSize }, (items, page) => {
			receivedPages.push({ page, itemsCount: items.length });
		});

		assert.equal(total, TOTAL_DOCUMENTS);
		assert.equal(batchSize, pageSize);
		assert.equal(pages, TOTAL_DOCUMENTS / pageSize);

		assert.equal(receivedPages.length, TOTAL_DOCUMENTS / pageSize);
		assert.deepEqual(receivedPages, [
			{ page: 1, itemsCount: pageSize },
			{ page: 2, itemsCount: pageSize },
			{ page: 3, itemsCount: pageSize }
		]);
	});

});
