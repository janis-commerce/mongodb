'use strict';

const { MongoClient, ObjectID } = require('mongodb');

const { pick } = require('lodash');

const logger = require('@janiscommerce/logger');

const MongoDBError = require('./mongodb-error');

const DEFAULT_LIMIT = 500;

const MONGODB_DEFAULT_PROTOCOL = 'mongodb://';

const MONGODB_DEFAULT_HOST = 'localhost';

/**
 * @class MongoDB
 * @classdesc MongoDB driver module
 */
class MongoDB {

	constructor(config) {
		if(!config || typeof config !== 'object' || Array.isArray(config))
			throw new MongoDBError('Invalid config', MongoDBError.codes.INVALID_CONFIG);

		this.config = {
			protocol: config.protocol || MONGODB_DEFAULT_PROTOCOL,
			host: config.host || MONGODB_DEFAULT_HOST,
			port: config.port || 27017,
			user: config.user || '',
			password: config.password || '',
			database: config.database || '',
			limit: config.limit || DEFAULT_LIMIT
		};
		// Avoid protocol duplication
		this.config.host = this.config.host.replace(this.config.protocol, '');
	}

	/**
	 * MongoDB connection URL user prefix
	 * @returns {String} MongoDB URL user prefix
	 */
	get userPrefix() {
		return this.config && this.config.user ? `${this.config.user}:${this.config.password}@` : '';
	}

	/**
	 * Checks the connection to the database
	 * @throws if the connection is not successfull
	 */
	async checkConnection() {
		if(!this.client) {
			try {

				this.client = await MongoClient.connect(

					`${this.config.protocol}${this.userPrefix}${this.config.host}:${this.config.port}/${this.config.database}`,
					{
						useNewUrlParser: true,
						w: 1 // Required by Mongo Atlas (or clusters)
					});

			} catch(err) {
				throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
			}
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

		const db = this.client.db(this.config.database);

		logger.info(`Creating indexes for ${this.config.database}.${model.constructor.table}`);

		try {
			if(model.constructor.uniqueIndexes) {
				for(const index of model.constructor.uniqueIndexes) {

					if(index === 'id') // Previene errores al mapear _id con id
						continue;

					await db.collection(model.constructor.table)
						.createIndex(this.formatIndex(index), {
							unique: true
						});

				}
			}

			if(model.constructor.indexes) {
				for(const index of model.constructor.indexes) {
					await db.collection(model.constructor.table)
						.createIndex(this.formatIndex(index));
				}
			}
		} catch(err) {
			throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	* Prepares the id field by mapping id into _id for data interaction with MongoDB, like getting filters and/or inserting data.
	* @param {Object} fields item fields
	*/
	prepareFields(fields) {
		if(typeof fields._id === 'undefined' && typeof fields.id === 'undefined')
			return;

		if(typeof fields.id !== 'undefined') {
			fields._id = ObjectID(fields.id);
			delete fields.id;
		}
	}

	/**
	* Prepares the id field by mapping id into _id from MongoDB getted data.
	* @param {Object} fields item fields
	* @returns {Object} parsed fields from MongoDB get method.
	*/
	prepareFieldsForOutput(fields) {
		fields.id = fields._id;
		delete fields._id;
		return fields;
	}

	/**
	 * Converts 'asc' and 'desc' order params into mongodb order params
	 * @param {Object} order Sort order
	 */
	parseSortingParams(order) {

		for(const key of Object.keys(order)) {

			if(order[key] === 'asc')
				order[key] = 1;
			else if(order[key] === 'desc')
				order[key] = -1;

		}
	}

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

		const db = this.client.db(this.config.database);

		const limit = params.limit || this.config.limit;

		const page = params.page || 1;

		const filters = params.filters || {};

		const order = params.order || { $natural: 1 };

		this.prepareFields(filters);
		this.parseSortingParams(order);

		try {

			const res = await db.collection(model.constructor.table)
				.find(filters)
				.sort(order)
				.skip((limit * page) - limit)
				.limit(limit)
				.toArray();

			model.lastQueryEmpty = !res.length;
			model.totalsParams = { ...params };

			return res.map(this.prepareFieldsForOutput);

		} catch(err) {
			throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Compares the model with the item then returns a common filter between both
	 * @param {Model} model Model instance
	 * @param {String} item item
	 * @returns {Object} filter
	 * @throws if there isn't a common filter between the model and the item
	 */
	getFilter(model, item) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if(!model.constructor.uniqueIndexes) {
			throw new MongoDBError(`Model requires unique indexes. See ${model.constructor.name}.uniqueIndexes`,
				MongoDBError.codes.MODEL_EMPTY_UNIQUE_INDEXES);
		}

		let filter;

		for(let index of model.constructor.uniqueIndexes) {

			if(!Array.isArray(index))
				index = [index];

			filter = pick(item, index);

			if(Object.keys(filter).length === index.length)
				break;

			filter = {};
		}

		if(!Object.keys(filter).length)
			throw new MongoDBError(`Operation requires unique indexes. See ${model.constructor.name}.uniqueIndexes`, MongoDBError.codes.EMPTY_UNIQUE_INDEXES);

		return filter;
	}

	cleanFields(fields) {
		if(typeof fields.dateCreated !== 'undefined')
			delete fields.dateCreated;

		if(typeof fields.lastModified !== 'undefined')
			delete fields.lastModified;
	}

	/**
	 * Insert/update one element into the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {Boolean} true/false
	 */
	async save(model, item = {}) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(this.config.database);

		const filter = this.getFilter(model, item);

		this.prepareFields(filter);
		this.prepareFields(item);

		if(typeof item._id !== 'undefined') // Previene errores en el upsert
			delete item._id;

		this.cleanFields(item);

		try {
			const res = await db.collection(model.constructor.table)
				.updateOne(filter, {
					$set: item,
					$currentDate: { lastModified: true },
					$setOnInsert: { dateCreated: new Date() }
				}, { upsert: true });

			return res.matchedCount === 1 || res.upsertedCount === 1;

		} catch(err) {
			throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Inserts data into the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {Boolean} true/false
	 */
	async insert(model, item) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(this.config.database);

		const setItem = { ...item };

		setItem.dateCreated = new Date();

		this.prepareFields(setItem);

		try {
			const res = await db.collection(model.constructor.table)
				.insertOne(setItem);

			return !!res.result.ok;

		} catch(err) {
			throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Updates data into the database
	 * @param {Model} model Model instance
	 * @param {Object} values values to apply
	 * @param {Object} filter mongodb filter
	 * @returns {Number} modified count
	 */
	async update(model, values, filter) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		await this.checkConnection();

		const db = this.client.db(this.config.database);

		const updateValues = { ...values };

		this.prepareFields(updateValues);
		this.prepareFields(filter);

		this.cleanFields(updateValues);

		const updateData = {
			$set: updateValues,
			$currentDate: { lastModified: true },
			$setOnInsert: { dateCreated: new Date() }
		};

		try {
			const res = await db.collection(model.constructor.table)
				.updateMany(filter, updateData);

			return res.modifiedCount;

		} catch(err) {
			throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
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

		if(!Array.isArray(items))
			throw new MongoDBError('Items must be an Array', MongoDBError.codes.INVALID_ITEM);

		await this.checkConnection();

		const db = this.client.db(this.config.database);

		items.forEach(item => {
			this.prepareFields(item);
			item.dateCreated = new Date();
		});

		try {
			const res = await db.collection(model.constructor.table)
				.insertMany(items);

			return !!res.result.ok;

		} catch(err) {
			throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
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

		if(!Array.isArray(items))
			throw new MongoDBError('Items must be an Array', MongoDBError.codes.INVALID_ITEM);

		await this.checkConnection();

		const db = this.client.db(this.config.database);

		const updateItems = items.map(item => {

			const filter = this.getFilter(model, item);

			this.prepareFields(item);
			this.prepareFields(filter);

			if(typeof item._id !== 'undefined') // Previene errores en el upsert
				delete item._id;

			this.cleanFields(item);

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
			stacks.push(db.collection(model.constructor.table).bulkWrite(stack));

		try {

			await Promise.all(stacks);

			return true;

		} catch(err) {
			throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
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

		const db = this.client.db(this.config.database);

		item = this.getFilter(model, item);

		this.prepareFields(item);

		try {
			const res = await db.collection(model.constructor.table)
				.deleteOne(item);

			return res.deletedCount === 1;

		} catch(err) {
			throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
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

		this.prepareFields(filter);

		const db = this.client.db(this.config.database);

		try {
			const res = await db.collection(model.constructor.table)
				.deleteMany(filter);

			return res.deletedCount;

		} catch(err) {
			throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Get the paginated totals from latest get query.
	 * @param {Model} model Model instance
	 * @returns {Object} total, page size, pages and page from the results.
	 */
	async getTotals(model) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if(model.lastQueryEmpty)
			return { total: 0, pages: 0 };

		await this.checkConnection();

		const db = this.client.db(this.config.database);

		const params = model.totalsParams || { filters: {} };

		try {
			const count = await db.collection(model.constructor.table)
				.countDocuments(params.filters);

			const result = {
				total: count,
				pageSize: params.limit ? params.limit : this.config.limit,
				pages: params.limit ? Math.ceil(count / params.limit) : 1,
				page: params.page ? params.page : 1
			};

			if(result.page > result.pages)
				result.page = result.pages;

			return result;

		} catch(err) {
			throw new MongoDBError(err.message, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}
}

module.exports = MongoDB;
