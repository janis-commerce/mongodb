'use strict';

const { MongoClient, ObjectID } = require('mongodb');

const { pick } = require('lodash');

const logger = require('@janiscommerce/logger');

const MongoDBError = require('./mongodb-error');

const DEFAULT_LIMIT = 500;

/**
 * @class MongoDB
 * @classdesc MongoDB driver module
 */
class MongoDB {

	constructor(config) {
		this.config = {
			host: config.host,
			limit: config.limit || DEFAULT_LIMIT
		};
	}

	/**
	 * Checks the connection to the database
	 * @throws if the connection is not successfull
	 */
	async checkConnection() {
		if(!this.client) {
			this.client = await MongoClient.connect(this.config.host, {
				useNewUrlParser: true
			});
		}
	}

	/**
	 * Format an index for mongodb
	 * @param {(String|Array)} index A simple index or array with complex index
	 * @returns {Object} formatted index
	 */
	formatIndex(index) {

		const formattedIndex = {};

		if(!Array.isArray(index))
			index = [index];

		for(const indexItem of index)
			formattedIndex[indexItem] = 1; // 1 for asc (default)

		return formattedIndex;
	}

	/**
	 * Create indexes
	 * @param {Object} model Model instance
	*/
	async createIndexes(model) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(model.dbname);

		logger.info(`Creating indexes for ${model.dbname}.${model.getTable()}`);

		if(model.constructor.uniqueIndexes) {
			model.constructor.uniqueIndexes.forEach(index => {
				db.collection(model.getTable())
					.createIndex(this.formatIndex(index), {
						unique: true
					});
			});
		}

		if(model.constructor.indexes) {
			model.constructor.indexes.forEach(index => {
				db.collection(model.getTable())
					.createIndex(this.formatIndex(index));
			});
		}
	}

	/* eslint-disable no-underscore-dangle */
	/**
	* Generates and appends the _id field into the fields if already doesn't have it.
	* @param {Object} fields item fields
	*/
	prepareFields(fields) {
		if(fields._id)
			fields._id = ObjectID(fields._id);
	}
	/* eslint-enable no-underscore-dangle */

	/**
	 * Get data from mongodb database
	 * @param {Model} model Model instance
	 * @param {Object} params parameters (limit and filters)
	 * @returns {Array} mongodb get result
	 */
	async get(model, params = {}) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(model.dbname);

		const limit = params.limit || this.config.limit;

		const filters = { ...params.filters };

		this.prepareFields(filters);

		return db.collection(model.getTable())
			.find(filters)
			.limit(limit)
			.toArray();
	}

	/**
	 * Compares the model with the item then returns a common filter between both
	 * @param {Model} model Model instance
	 * @param {(String|Array)} item item
	 * @returns {Object} filter
	 * @throws if there isn't a common filter between the model and the item
	 */
	getFilter(model, item) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if(!model.constructor.indexes)
			throw new MongoDBError(`Model requires indexes. See ${model.constructor.name}.indexes`, MongoDBError.codes.MODEL_EMPTY_INDEXES);

		let filter;

		for(let index of model.constructor.indexes) {

			if(!Array.isArray(index))
				index = [index];

			filter = pick(item, index);

			if(Object.keys(filter).length === index.length)
				break;

			filter = {};
		}

		if(!Object.keys(filter).length)
			throw new MongoDBError(`Operation requires indexes. See ${model.constructor.name}.indexes`, MongoDBError.codes.EMPTY_INDEXES);

		return filter;
	}

	/**
	 * Insert/update one element into the database
	 * @param {Model} model Model instance
	 * @param {(Object|Array)} item item
	 * @returns {Boolean} true/false
	 */
	async save(model, item) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(model.dbname);

		const filter = this.getFilter(model, item);

		const setItem = { ...item };

		this.prepareFields(setItem);

		const res = await db.collection(model.getTable())
			.updateOne(filter, {
				$set: setItem,
				$currentDate: { lastModified: true },
				$setOnInsert: { dateCreated: new Date() }
			}, { upsert: true });

		return res.matchedCount === 1 || res.upsertedCount === 1;
	}

	/**
	 * Inserts data into the database
	 * @param {Model} model Model instance
	 * @param {(Object|Array)} item item
	 * @returns {Boolean} true/false
	 */
	async insert(model, item) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(model.dbname);

		try {

			const setItem = { ...item };

			setItem.dateCreated = new Date();

			this.prepareFields(setItem);

			const res = await db.collection(model.getTable())
				.insertOne(setItem);

			return !!res.result.ok;

		} catch(error) {
			return false;
		}
	}

	/**
	 * Updates data into the database
	 * @param {Model} model Model instance
	 * @param {(Object|Array)} values values to apply
	 * @param {Object} filter mongodb filter
	 * @returns {Number} modified count
	 */
	async update(model, values, filter) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(model.dbname);

		const updateValues = { ...values };
		this.prepareFields(updateValues);

		const updateData = {
			$set: updateValues,
			$currentDate: { lastModified: true },
			$setOnInsert: { dateCreated: new Date() }
		};

		const res = await db.collection(model.getTable())
			.updateMany(filter, updateData);

		return res.modifiedCount;
	}

	/**
	 * Multi insert items into the dabatase
	 * @param {Model} model Model instance
	 * @param {Array} items items
	 * @returns {Boolean} true/false
	 */
	async multiInsert(model, items) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(model.dbname);

		items.forEach(item => {
			this.prepareFields(item);
			item.dateCreated = new Date();
		});

		const res = await db.collection(model.getTable())
			.insertMany(items);

		return !!res.result.ok;
	}

	/**
	 * Multi insert/update items into the dabatase
	 * @param {Model} model Model instance
	 * @param {Array} items items
	 * @param {Number} limit specifies the limit of items that can be bulk writed into monogdb at the same time
	 * @returns {Boolean} true/false
	 */
	async multiSave(model, items, limit = 1000) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(model.dbname);

		const updateItems = items.map(item => {

			const filter = this.getFilter(model, item);
			const update = {
				$set: item,
				$currentDate: { lastModified: true },
				$setOnInsert: { dateCreated: new Date() }
			};

			return { updateOne: { filter, update, upsert: true } };

		}).filter(Boolean);

		if(!updateItems.length)
			return false;

		const itemStacks = [];
		const stacks = [];

		if(updateItems.length > limit) {

			let stackIndex = 0;

			for(let i = 0; i < updateItems.length; i++) {

				if(!itemStacks[stackIndex])
					itemStacks[stackIndex] = [];

				if(itemStacks[stackIndex].length === limit) {
					stackIndex++;
					itemStacks[stackIndex] = [];
				}

				itemStacks[stackIndex].push(updateItems[i]);
			}

		} else
			itemStacks[0] = updateItems;

		for(const stack of itemStacks)
			stacks.push(db.collection(model.getTable()).bulkWrite(stack));

		try {
			await Promise.all(stacks);
		} catch(error) {
			return false;
		}

		return true;
	}

	/**
	 * Removes an item from the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {Boolean} true/false
	 */
	async remove(model, item) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(model.dbname);

		item = this.getFilter(model, item);

		const res = await db.collection(model.getTable())
			.deleteOne(item);

		return res.deletedCount === 1;
	}

	/**
	 * Multi remove items from the database
	 * @param {Model} model Model instance
	 * @param {filter} filter mongodb filter
	 * @returns {Number} deleted count
	 */
	async multiRemove(model, filter) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		filter = this.getFilter(model, filter);

		const db = this.client.db(model.dbname);

		const res = await db.collection(model.getTable())
			.deleteMany(filter);

		return res.deletedCount;
	}
}

module.exports = MongoDB;
