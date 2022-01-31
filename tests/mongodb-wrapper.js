'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { MongoClient: RealMongoClient, ObjectID: RealObjectID } = require('mongodb');

const { MongoWrapper, ObjectID } = require('../lib/mongodb-wrapper');

describe('ObjectID', () => {
	it('Should export the Mongo ObjectID', () => {
		assert.deepStrictEqual(ObjectID, RealObjectID);
	});
});

describe('MongoWrapper', () => {

	const config = {
		protocol: 'mongodb://',
		host: 'localhost',
		port: 27017,
		database: 'myDatabase',
		user: '',
		password: ''
	};

	const connectionParams = {
		writeConcern: { w: 1 }
	};

	beforeEach(() => {
		sinon.stub(RealMongoClient.prototype, 'connect');
		config.host = `${Date.now()}.localhost`;
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('Connection params', () => {

		it('Should have the proper connection params', () => {
			const mongoWrapper = new MongoWrapper({});
			assert.deepStrictEqual(mongoWrapper.connectionParams, connectionParams);
		});

		it('Should format the connection string with the minimum config params', () => {

			const { protocol, host } = config;

			const mongoWrapper = new MongoWrapper({ protocol, host });

			assert.strictEqual(mongoWrapper.connectionString, `mongodb://${config.host}`);
		});

		it('Should format the connection string with every config params', () => {

			const mongoWrapper = new MongoWrapper({
				...config,
				user: 'john.doe',
				password: 'Str0ngP4ss',
				port: 5646
			});

			assert.strictEqual(mongoWrapper.connectionString, `mongodb://john.doe:Str0ngP4ss@${config.host}:5646/myDatabase`);
		});

		it('Should format the connection string with complex hostname', () => {

			const mongoWrapper = new MongoWrapper({
				protocol: 'mongodb+srv://',
				host: 'test.foo.mongodb.net/test?retryWrites=true&w=majority',
				database: 'myDatabase',
				user: 'john.doe',
				password: 'Str0ngP4ss',
				port: 5646
			});

			assert.strictEqual(
				mongoWrapper.connectionString,
				'mongodb+srv://john.doe:Str0ngP4ss@test.foo.mongodb.net:5646/myDatabase?retryWrites=true&w=majority'
			);

		});

	});

	describe('makeQuery()', () => {

		class Model {
			static get table() {
				return 'myCollection';
			}
		}

		const model = new Model();

		it('Should reject if connection fails', async () => {

			RealMongoClient.prototype.connect.rejects(new Error('Connection error'));

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper(config);
			await assert.rejects(() => mongoWrapper.makeQuery(model, callback));

			sinon.assert.notCalled(callback);
			sinon.assert.calledOnce(RealMongoClient.prototype.connect);
		});

		it('Should generate the connection string without user and password', async () => {

			RealMongoClient.prototype.connect.resolves({
				db: sinon.stub().returns({
					collection: sinon.stub()
				})
			});

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper(config);
			await mongoWrapper.makeQuery(model, callback);

			sinon.assert.calledOnceWithExactly(RealMongoClient.prototype.connect);
		});

		it('Should generate the connection string with user and password', async () => {

			RealMongoClient.prototype.connect.resolves({
				db: sinon.stub().returns({
					collection: sinon.stub()
				})
			});

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper({
				...config,
				user: 'foo',
				password: 'bar'
			});
			await mongoWrapper.makeQuery(model, callback);

			sinon.assert.calledOnceWithExactly(RealMongoClient.prototype.connect);
		});

		it('Should call the callback, passing the collection defined by the model', async () => {

			const collection = {};
			const collectionStub = sinon.stub().returns(collection);

			RealMongoClient.prototype.connect.resolves({
				db: sinon.stub().returns({
					collection: collectionStub
				})
			});

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper({ ...config });
			await mongoWrapper.makeQuery(model, callback);

			sinon.assert.calledOnce(collectionStub);
			sinon.assert.calledWithExactly(collectionStub, 'myCollection');

			sinon.assert.calledOnce(callback);
			sinon.assert.calledWithExactly(callback, collection);
		});

		it('Should connect only once for the same DB config key', async () => {

			RealMongoClient.prototype.connect.resolves({
				isConnected: sinon.stub().returns(true),
				db: sinon.stub().returns({
					collection: sinon.stub()
				})
			});

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper({ ...config });

			await mongoWrapper.makeQuery(model, callback);
			await mongoWrapper.makeQuery(model, callback);

			const mongoWrapper2 = new MongoWrapper({ ...config, database: 'myDatabase2' });

			await mongoWrapper2.makeQuery(model, callback);

			sinon.assert.calledOnce(RealMongoClient.prototype.connect);
		});
	});
});
