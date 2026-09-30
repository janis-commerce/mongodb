'use strict';

const assert = require('node:assert').strict;

const MongoDB = require('../../lib/mongodb');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection } = require('./_helpers');

describe('dropDatabase()', () => {

	const DROP_DATABASE = 'integration-tests-drop-database';

	// Same host as the shared instance (the driver client is reused), but another database: never drops the shared one
	const getIsolatedInstance = () => new MongoDB({
		connectionString: process.env.MONGODB_INTEGRATION_URI,
		database: DROP_DATABASE
	});

	const listDatabaseNames = async () => {
		const db = await getMongodbInstance().mongo.getDb();
		const { databases } = await db.admin().listDatabases({ nameOnly: true });
		return databases.map(database => database.name);
	};

	afterEach(async () => {
		await getIsolatedInstance().dropDatabase();
		await cleanCollection();
	});

	it('Should drop the configured database and return true, leaving the shared database intact', async () => {

		const shared = getMongodbInstance();
		const isolated = getIsolatedInstance();
		const model = new TestModel();

		await shared.insert(model, { name: 'Shared' });
		await isolated.createIndexes(model, TestModel.indexes);
		await isolated.insert(model, { name: 'Isolated' });

		assert.ok((await listDatabaseNames()).includes(DROP_DATABASE));

		const result = await isolated.dropDatabase();

		assert.equal(result, true);
		assert.equal((await listDatabaseNames()).includes(DROP_DATABASE), false);
		assert.deepEqual(await isolated.get(model), []);

		const sharedItems = await shared.get(model);

		assert.equal(sharedItems.length, 1);
		assert.equal(sharedItems[0].name, 'Shared');
	});

	it('Should resolve true when the database does not exist', async () => {

		const isolated = getIsolatedInstance();

		await isolated.dropDatabase();

		assert.equal(await isolated.dropDatabase(), true);
	});

});
