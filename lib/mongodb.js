'use strict';

const { inspect } = require('util');

const ConfigValidator = require('./config-validator');

const { MongoWrapper } = require('./mongodb-wrapper');

const MongoDBFilters = require('./mongodb-filters');
const MongoDBError = require('./mongodb-error');

const ObjectIdHelper = require('./helpers/object-id');
const MongoDBSort = require('./helpers/sort');
const UniqueMatcher = require('./helpers/unique-matcher');
const validateIndexes = require('./helpers/validate-indexes');
const SetOnInsertParser = require('./helpers/set-on-insert-parser');

const IncrementValidator = require('./helpers/increment-validator');

/**
 * @class MongoDB
 * @classdesc MongoDB driver module
 */
module.exports = class MongoDB {

	constructor(config) {
		this.config = ConfigValidator.validate(config);
		this.mongo = new MongoWrapper(this.config);
	}

	/**
	 * Get distinct values of a field
	 *
	 * @param {Model} model Model instance
	 * @param {Object} params parameters (key and filters)
	 * @return {Array} mongodb get result
	 */
	async distinct(model, params = {}) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const { key } = params;

		if(!key || typeof key !== 'string')
			throw new MongoDBError(`Distinct key must be a string. Received ${inspect(key)}`, MongoDBError.codes.INVALID_DISTINCT_KEY);

		const filters = MongoDBFilters.parseFilters(params.filters, model);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection.distinct(key, filters));

			return res;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
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

		const limit = params.limit || this.config.limit;
		const page = params.page || 1;
		const order = MongoDBSort.parseSortingParams(params.order);
		const filters = MongoDBFilters.parseFilters(ObjectIdHelper.ensureObjectIdsForWrite(model, params.filters || {}), model);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.find(filters)
				.sort(order)
				.skip((limit * page) - limit)
				.limit(limit)
				.toArray());

			model.lastQueryHasResults = !!res.length;
			model.totalsParams = {
				limit,
				page,
				filters,
				order
			};

			return res.map(item => ObjectIdHelper.mapIdForClient(item));

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Insert/update one element into the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @param {Object} setOnInsert Default Values for Insert items
	 * @returns {String} ID
	 */
	async save(model, item, setOnInsert) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, item);

		const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

		try {

			const { _id, dateCreated, dateModified, ...setData } = mongoItem; // Remove to prevent upsert errors

			const defaults = SetOnInsertParser.parse(setOnInsert, setData); // Remove to prevent upsert errors using default values

			const operationGroupedValues = this.groupByWriteOperation(setData, {
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: new Date(), ...defaults }
			});

			const res = await this.mongo.makeQuery(model, collection => collection
				.findAndModify(filters, {}, operationGroupedValues, { upsert: true, new: true }));

			return res && res.value && res.value._id.toString();

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Inserts data into the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {String} ID of the object inserted
	 */
	async insert(model, item) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		try {

			const mongoItem = {
				...ObjectIdHelper.ensureObjectIdsForWrite(model, item),
				dateCreated: new Date()
			};

			const res = await this.mongo.makeQuery(model, collection => collection
				.insertOne(mongoItem));

			return res.insertedId.toString();

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Updates data into the database
	 * @param {Model} model Model instance
	 * @param {Object} values values to apply
	 * @param {Object} filters mongodb filters
	 * @param {Object} options mongodb options
	 * @returns {Number} modified count
	 */
	async update(model, values, filters, options) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		try {

			const operationGroupedValues = this.groupByWriteOperation(values, {
				$set: {
					dateModified: new Date()
				}
			});

			const updateData = Object.entries(operationGroupedValues)
				.reduce((acum, [operation, operationValues]) => ({
					...acum,
					[operation]: ObjectIdHelper.ensureObjectIdsForWrite(model, operationValues)
				}), {});

			const res = await this.mongo.makeQuery(model, collection => collection
				.updateMany(MongoDBFilters.parseFilters(ObjectIdHelper.ensureObjectIdsForWrite(model, filters || {}), model), updateData, options || {}));

			return res.modifiedCount;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
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

		if(!items.length)
			throw new MongoDBError('Items must not be empty', MongoDBError.codes.INVALID_ITEM);

		try {

			const mongoItems = items.map(item => ({
				...ObjectIdHelper.ensureObjectIdsForWrite(model, item),
				dateCreated: new Date()
			}));

			const res = await this.mongo.makeQuery(model, collection => collection
				.insertMany(mongoItems));

			return res.ops.map(item => ObjectIdHelper.mapIdForClient(item));

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Multi insert/update items into the dabatase
	 * @param {Model} model Model instance
	 * @param {Array} items items
	 * @param {Object} setOnInsert Default Values for Insert items
	 * @returns {Boolean} true/false
	 */
	async multiSave(model, items, setOnInsert) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if(!Array.isArray(items))
			throw new MongoDBError('Items must be an Array', MongoDBError.codes.INVALID_ITEM);

		if(!items.length)
			throw new MongoDBError('Items must not be empty', MongoDBError.codes.INVALID_ITEM);

		const bulkItems = items.map(item => {

			const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, item);

			const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

			const { _id, dateCreated, dateModified, ...setData } = mongoItem; // Remove to prevent upsert errors

			const defaults = SetOnInsertParser.parse(setOnInsert, setData); // Remove to prevent upsert errors using default values

			const operationGroupedValues = this.groupByWriteOperation(setData, {
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: new Date(), ...defaults }
			});

			return { updateOne: { filter: filters, update: operationGroupedValues, upsert: true } };
		});

		try {

			await this.mongo.makeQuery(model, collection => collection
				.bulkWrite(bulkItems));

			return true;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
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

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, item);

		const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.deleteOne(filters));

			return res.deletedCount === 1;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Multi remove items from the database
	 * @param {Model} model Model instance
	 * @param {Object} filter mongodb filter
	 * @returns {Number} deleted count
	 */
	async multiRemove(model, filter) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, filter);

		const filters = MongoDBFilters.parseFilters(mongoItem, model);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.deleteMany(filters));

			return res.deletedCount;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
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

		if(!model.lastQueryHasResults)
			return { total: 0, pages: 0 };

		const { filters, limit, page } = model.totalsParams;

		try {

			const count = await this.mongo.makeQuery(model, collection => collection
				.countDocuments(filters));

			const result = {
				total: count,
				pageSize: limit,
				pages: Math.ceil(count / limit),
				page
			};

			return result;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Increment values in registry
	 * @param {Model} model Model instance
	 * @param {Object} filters unique filters
	 * @param {Object} incrementData Values to Increment
	 * @param {Object} setData Data to Add
	 * @returns {Object} Registry updated
	 */
	async increment(model, filter, incrementData, setData) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, filter);

		const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

		const increments = IncrementValidator.validate(incrementData);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.findAndModify(filters, {}, {
					$inc: increments,
					$set: {
						...setData,
						dateModified: new Date()
					}
				}, { upsert: false, new: true })); // 'new: true' return the object updated

			return res.value;
		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Get the indexes of the model collection
	 * @param {Model} model Model instance
	 * @returns {Array.<object>} An array with the indexes
	 */
	async getIndexes(model) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		try {

			const indexes = await this.mongo.makeQuery(model, collection => collection
				.indexes());

			return indexes;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Creates the received indexes into the model collection
	 * @param {Model} model Model instance
	 * @param {Array.<object>} indexes An array with the indexes to create
	 * @returns {Boolean} true/false
	 */
	async createIndexes(model, indexes) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		validateIndexes(indexes);

		try {

			const result = await this.mongo.makeQuery(model, collection => collection
				.createIndexes(indexes));

			return !!result.ok;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Creates the received index into the model collection
	 * @param {Model} model Model instance
	 * @param {Object} index index object
	 * @returns {Boolean} true/false
	 */
	async createIndex(model, index) {
		return this.createIndexes(model, [index]);
	}

	/**
	 * Drops an index from the model collection by index name
	 * @param {Model} model Model instance
	 * @param {String} indexName index name
	 * @returns {Boolean} true/false
	 */
	async dropIndex(model, indexName) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if(typeof indexName !== 'string')
			throw new MongoDBError('Invalid index name: Should exist and must be a string', MongoDBError.codes.INVALID_INDEX);

		try {

			const result = await this.mongo.makeQuery(model, collection => collection
				.dropIndex(indexName));

			return !!result.ok;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Drops multiple indexes from the model collection by index name
	 * @param {Model} model Model instance
	 * @param {Array.<string>} indexNames An array with the names of the indexes
	 * @returns {Boolean} true/false
	 */
	async dropIndexes(model, indexNames) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if(!Array.isArray(indexNames))
			throw new MongoDBError('Invalid indexes names: Should exist and must be an array', MongoDBError.codes.INVALID_INDEX);

		try {

			const results = await Promise.all(indexNames.map(indexName => this.dropIndex(model, indexName)));

			return results.reduce((prev, curr) => (!curr ? false : prev), true); // returns true only when all the results are true otherwise returns false

		} catch(err) {
			throw err;
		}
	}

	/**
	 * Drops the database of the current `config`
	 * @returns {Boolean} true/false
	 */
	async dropDatabase() {

		try {

			const result = await this.mongo.dropDatabase();

			return !!result.ok;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	groupByWriteOperation(values, initialValues) {
		return Object.entries(values)
			.reduce((acum, [key, value]) => {

				const includedOp = key.startsWith('$');
				const op = key.startsWith('$') ? key : '$set';

				const { [op]: current } = acum;

				return {
					...acum,
					[op]: {
						...current,
						...(includedOp ? value : { [key]: value })
					}
				};
			}, initialValues);
	}
};
