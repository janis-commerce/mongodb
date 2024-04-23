'use strict';

/**
 * @typedef {import('mongodb').Document} MongoDocument
 */

/**
 * @callback GetPagedCallback
 * @param {Array<Entity} items The items that where found in the current page
 * @param {number} page The page number
 * @param {number} limit The page max size
 * @returns {void | Promise<void>}
 */

/**
 * @typedef {object} GetTotalsResult
 * @property {number} total
 * @property {number} pageSize
 * @property {number} pages
 * @property {number} page
 */

const { struct } = require('@janiscommerce/superstruct');

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
const MongoDBProject = require('./helpers/project');

const IncrementValidator = require('./helpers/increment-validator');
const prepareDateCreated = require('./helpers/prepare-date-created');

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
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {object} params parameters (key and filters)
	 * @return {Promise<Array>} mongodb distinct result
	 */
	async distinct(model, params = {}) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const { key } = params;

		if (!key || typeof key !== 'string')
			throw new MongoDBError(`Distinct key must be a string. Received ${inspect(key)}`, MongoDBError.codes.INVALID_DISTINCT_KEY);

		const filters = MongoDBFilters.parseFilters(params.filters, model);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection.distinct(key, filters));

			return res;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Get data from mongodb database
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {object} params parameters (limit and filters)
	 * @returns {Promise<MongoDocument[]>} The list of documents found
	 */
	async get(model, params = {}) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const limit = params.limit || this.config.limit;
		const page = params.page || 1;
		const sort = MongoDBSort.parseSortingParams(params.order);

		const filters = MongoDBFilters.parseFilters(ObjectIdHelper.ensureObjectIdsForWrite(model, params.filters || {}), model);
		const project = MongoDBProject.parse(params);

		try {

			const documents = await this.mongo.makeQuery(model, cursor => {

				cursor = cursor
					.find(filters);

				if (sort)
					cursor.sort(sort); // before project(), could need a field to sort()

				if (project)
					cursor.project(project);

				cursor
					.skip((limit * page) - limit)
					.limit(limit);

				return cursor.toArray();
			});

			model.totalsParams = {
				length: documents.length,
				limit,
				page,
				filters,
				order: sort
			};

			return documents.map(document => ObjectIdHelper.mapIdForClient(document));

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Get data from mongodb database
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {object} params parameters (limit and filters)
	 * @param {GetPagedCallback} callback Function to call for each batch of items
	 * @returns {Promise<MongoDocument[]>} The list of documents found
	 */
	async getPaged(model, params = {}, callback) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const sort = MongoDBSort.parseSortingParams(params.order);
		const batchSize = params.limit || this.config.limit;

		const filters = MongoDBFilters.parseFilters(ObjectIdHelper.ensureObjectIdsForWrite(model, params.filters || {}), model);
		const project = MongoDBProject.parse(params);

		try {

			let page = 0;
			let total = 0;

			await this.mongo.makeQuery(model, async collection => {

				const cursor = collection
					.find(filters);

				if (sort)
					cursor.sort(sort); // before project(), could need a field to sort()

				if (project)
					cursor.project(project);

				cursor.batchSize(batchSize);

				let pageItems = [];

				for await (const item of cursor) {

					total++;
					pageItems.push(ObjectIdHelper.mapIdForClient(item));

					if (pageItems.length === batchSize) {
						page++;
						await callback.call(null, pageItems, page, batchSize);
						pageItems = [];
					}
				}

				if (pageItems.length) {
					page++;
					await callback.call(null, pageItems, page, batchSize);
					pageItems = [];
				}
			});

			return {
				total,
				batchSize,
				pages: page
			};

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Insert/update one element into the database
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {MongoDocument} item item
	 * @param {MongoDocument} setOnInsert Default Values for Insert items
	 * @returns {Promise<string>} The created/updated document ID
	 */
	async save(model, item, setOnInsert) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, item);

		const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

		try {

			const { _id, dateCreated, dateModified, ...setData } = mongoItem; // Remove to prevent upsert errors

			const defaults = SetOnInsertParser.parse(setOnInsert, setData); // Remove to prevent upsert errors using default values

			const operationGroupedValues = this.groupByWriteOperation(setData, {
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: prepareDateCreated(dateCreated), ...defaults }
			});

			/** @type {{ value: import('mongodb').WithId<MongoDocument>}} */
			const res = await this.mongo.makeQuery(model, collection => collection
				.findOneAndUpdate(filters, operationGroupedValues, { upsert: true, returnNewDocument: true }));

			return res.value ? res.value._id.toString() : res.lastErrorObject.upserted?.toString();

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Inserts data into the database
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {MongoDocument} item item
	 * @returns {Promise<string>} ID of the object inserted
	 */
	async insert(model, item) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		try {

			const mongoItem = {
				...ObjectIdHelper.ensureObjectIdsForWrite(model, item),
				dateCreated: prepareDateCreated(item.dateCreated)
			};

			const res = await this.mongo.makeQuery(model, collection => collection
				.insertOne(mongoItem));

			return res.insertedId.toString();

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Updates data into the database
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {MongoDocument|Array<MongoDocument} values values to apply
	 * @param {import('mongodb').UpdateFilter} filters mongodb filters
	 * @param {import('mongodb').UpdateOptions} options mongodb options
	 * @returns {Promise<number>} The amount of documents updated
	 */
	async update(model, values, filters, options = {}) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		try {

			const operationData = Array.isArray(values) ? [...values] : [values];

			const { updateOne, skipAutomaticSetModifiedData, ...restOfOptions } = options;

			if (!skipAutomaticSetModifiedData) {
				operationData.push({
					$set: {
						dateModified: new Date()
					}
				});
			}

			const operationGroupedValues = Array.isArray(values)
				? operationData.map(value => this.formatPipelineStage(value))
				: this.groupByWriteOperation(...operationData);

			const updateData = Array.isArray(operationGroupedValues)
				? operationGroupedValues.map(value => this.getUpdateData(model, value))
				: this.getUpdateData(model, operationGroupedValues);

			filters = MongoDBFilters.parseFilters(ObjectIdHelper.ensureObjectIdsForWrite(model, filters || {}), model);

			const updateMethod = updateOne ? 'updateOne' : 'updateMany';

			/** @type {import('mongodb').UpdateResult} */
			const res = await this.mongo.makeQuery(model, collection => collection[updateMethod](filters, updateData, restOfOptions));

			return res.modifiedCount;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 *
	 * @private
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {object} operationGroupedValues
	 * @returns {object}
	 */
	getUpdateData(model, operationGroupedValues) {
		return Object.entries(operationGroupedValues)
			.reduce((updateData, [operation, operationValues]) => ({
				...updateData,
				[operation]: ObjectIdHelper.ensureObjectIdsForWrite(model, operationValues)
			}), {});
	}

	/**
	 * Multi insert items into the database
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {MongoDocument[]} items items
	 * @param {object} options
	 * @returns {Promise<string[]>} true/false
	 */
	async multiInsert(model, items, options = {}) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if (!Array.isArray(items))
			throw new MongoDBError('Items must be an Array', MongoDBError.codes.INVALID_ITEM);

		if (!items.length)
			throw new MongoDBError('Items must not be empty', MongoDBError.codes.INVALID_ITEM);

		const mongoItems = items.map(item => ({
			...ObjectIdHelper.ensureObjectIdsForWrite(model, item),
			dateCreated: prepareDateCreated(item.dateCreated)
		}));

		let indexesWithError = [];
		let indexesAndIds = [];

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.insertMany(mongoItems, { ordered: false }));

			/**
				  res.insertedIds: {
					'0': new ObjectId("64074bbbcd9d737d71f0465b"),
					'1': new ObjectId("64074bbbcd9d737d71f0465c"),
					'2': new ObjectId("64074bbbcd9d737d71f0465d")
				}
			*/

			indexesAndIds = Object.entries(res.insertedIds)
				.map(([index, _id]) => ({ index, _id }));

		} catch (err) {

			if (err.message.indexOf('E11000 duplicate key error collection') || options.failOnDuplicateErrors)
				throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);

			const { insertedIds, writeErrors } = err.result.result;

			/**
				insertedIds: [
					{ index: 0, _id: new ObjectId("64074bd646b0f68dfdb6a6f2") },
					{ index: 1, _id: new ObjectId("64074bd646b0f68dfdb6a6f3") },
					{ index: 2, _id: new ObjectId("64074bd646b0f68dfdb6a6f4") }
				]
			*/

			indexesAndIds = [...insertedIds];

			indexesWithError = writeErrors.map(({ index }) => index);
		}

		return indexesAndIds.map(({ index, _id }) => ObjectIdHelper.mapIdForClient({
			...items[index],
			dateCreated: mongoItems[index].dateCreated,
			_id
		})).filter((item, index) => !indexesWithError.includes(index));
	}

	/**
	 * Multi insert/update items into the database
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {MongoDocument[]} items items
	 * @param {MongoDocument} setOnInsert Default Values for Insert items
	 * @returns {Promise<boolean>} true/false
	 */
	async multiSave(model, items, setOnInsert) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if (!Array.isArray(items))
			throw new MongoDBError('Items must be an Array', MongoDBError.codes.INVALID_ITEM);

		if (!items.length)
			throw new MongoDBError('Items must not be empty', MongoDBError.codes.INVALID_ITEM);

		const bulkItems = items.map(item => {

			const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, item);

			const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

			const { _id, dateCreated, dateModified, ...setData } = mongoItem; // Remove to prevent upsert errors

			const defaults = SetOnInsertParser.parse(setOnInsert, setData); // Remove to prevent upsert errors using default values

			const operationGroupedValues = this.groupByWriteOperation(setData, {
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: prepareDateCreated(dateCreated), ...defaults }
			});

			return { updateOne: { filter: filters, update: operationGroupedValues, upsert: true } };
		});

		try {

			await this.mongo.makeQuery(model, collection => collection
				.bulkWrite(bulkItems));

			return true;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Multi insert/update items into the database
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {MongoDocument[]} operations update operations to perform
	 * @returns {Promise<boolean>} true/false
	 */
	async multiUpdate(model, operations) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if(!Array.isArray(operations))
			throw new MongoDBError('Operations must be an Array', MongoDBError.codes.INVALID_ITEM);

		if(!operations.length)
			throw new MongoDBError('Operations must not be empty', MongoDBError.codes.INVALID_ITEM);

		const bulkItems = operations.map(({ filter, data }) => {

			const { id, dateModified, dateCreated, ...dataToUpdate } = data; // to avoid overriding

			return {
				updateMany: {
					filter,
					update: {
						$set: dataToUpdate
					},
					$currentDate: { dateModified: true }
				}
			};
		});

		try {

			await this.mongo.makeQuery(model, collection => collection
				.bulkWrite(bulkItems));

			return true;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Removes an item from the database
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {MongoDocument} item item
	 * @returns {Promise<boolean>} true/false
	 */
	async remove(model, item) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, item);

		const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.deleteOne(filters));

			return res.deletedCount === 1;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Multi remove items from the database
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {object} filter mongodb filter
	 * @returns {Promise<number>} deleted count
	 */
	async multiRemove(model, filter) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, filter);

		const filters = MongoDBFilters.parseFilters(mongoItem, model);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.deleteMany(filters));

			return res.deletedCount;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Get the paginated totals from latest get query.
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @returns {Promise<GetTotalsResult>} total, page size, pages and page from the results.
	 */
	async getTotals(model, filter) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const {
			length,
			filters: paramsFilters = {},
			limit = this.config.limit,
			page = 0
		} = model.totalsParams || {};

		if (length === 0)
			return { total: 0, pages: 0 };

		const parsedFilters = MongoDBFilters.parseFilters(ObjectIdHelper.ensureObjectIdsForWrite(model, filter), model);

		const filters = Object.keys(parsedFilters).length ? parsedFilters : paramsFilters;

		try {

			/**
			 *  length es la cantidad de documentos que devolvió el find() con los filtros y paginado
			 *  limit es la cantidad de registros por pagina que se solicitó
			 *  cuando el length es menor que limit, significa que "es la ultima pagina"
			 *  cuando es la ultima página se puede deducir el total sin necesidad de hacer la query...
			 *  se pueden multiplicar el limit por las paginas "anteriores" y luego sumar el length
			 *
			 *  escenario 1 { length: 10, limit: 20, page: 7 }
			 * 	=> (6 {page-1} * 20 {limit}) + 10 {length} = 130 {total}
			 *  escenario 2 { length: 1, limit: 60, page: 450 }
			 * 	=> (449 {page-1} * 60 {limit}) + 1 {length} = 26941 {total}
			 */

			let total;

			if (length && page > 0 && length < limit)
				total = ((page - 1) * limit) + length;
			else if (Object.keys(filters).length) {
				total = await this.mongo.makeQuery(model, collection => collection
					.countDocuments(filters));
			} else {

				// db.collection.estimatedDocumentCount() does not take a query filter and instead uses metadata to return the count for a collection.
				// https://www.mongodb.com/docs/manual/reference/method/db.collection.estimatedDocumentCount/

				total = await this.mongo.makeQuery(model, collection => collection
					.estimatedDocumentCount());
			}

			const result = {
				total,
				pageSize: limit,
				pages: Math.ceil(total / limit),
				page
			};

			return result;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Increment values in registry
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {object} filters unique filters
	 * @param {object} incrementData Values to Increment
	 * @param {object} setData Data to Add
	 * @returns {Promise<MongoDocument>} Registry updated
	 */
	async increment(model, filter, incrementData, setData) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, filter);

		const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

		const increments = IncrementValidator.validate(incrementData);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.findOneAndUpdate(filters, {
					$inc: increments,
					$set: {
						...setData,
						dateModified: new Date()
					}
				}, { upsert: false, returnNewDocument: true })); // 'returnNewDocument: true' return the updated document

			return res.value;
		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Get the indexes of the model collection
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @returns {Promise<MongoDocument[]>} An array with the indexes
	 */
	async getIndexes(model) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		try {

			const indexes = await this.mongo.makeQuery(model, collection => collection
				.indexes());

			return indexes;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Creates the received indexes into the model collection
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {Array<import('mongodb').IndexDescription>} indexes An array with the indexes to create
	 * @returns {Promise<boolean>} true/false
	 */
	async createIndexes(model, indexes) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		validateIndexes(indexes);

		try {

			const result = await this.mongo.makeQuery(model, collection => collection
				.createIndexes(indexes));

			return !!result.length;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Creates the received index into the model collection
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {import('mongodb').IndexDescription} index index object
	 * @returns {Promise<boolean>} true/false
	 */
	createIndex(model, index) {
		return this.createIndexes(model, [index]);
	}

	/**
	 * Drops an index from the model collection by index name
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {string} indexName index name
	 * @returns {Promise<boolean>} true/false
	 */
	async dropIndex(model, indexName) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if (typeof indexName !== 'string')
			throw new MongoDBError('Invalid index name: Should exist and must be a string', MongoDBError.codes.INVALID_INDEX);

		try {

			const result = await this.mongo.makeQuery(model, collection => collection
				.dropIndex(indexName));

			return !!result.ok;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Drops multiple indexes from the model collection by index name
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {string[]} indexNames An array with the names of the indexes
	 * @returns {Promise<boolean>} true/false
	 */
	async dropIndexes(model, indexNames) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if (!Array.isArray(indexNames))
			throw new MongoDBError('Invalid indexes names: Should exist and must be an array', MongoDBError.codes.INVALID_INDEX);

		try {

			const results = await Promise.all(indexNames.map(indexName => this.dropIndex(model, indexName)));

			// Returns true only when all the results are true otherwise returns false
			return results.every(result => !!result);

		} catch (err) {
			throw err;
		}
	}

	/**
	 * Drops the database of the current `config`
	 * @returns {Promise<boolean>} true/false
	 */
	async dropDatabase() {

		try {

			const result = await this.mongo.dropDatabase();

			return !!result;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Drops a collection from the database of the current `config`
	 * @returns {Promise<boolean>} true/false
	 */
	async dropCollection(collection) {

		try {

			const result = await this.mongo.dropCollection(collection);

			return !!result;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Delete all documents from a collection from the database of the current `config`
	 * @param {object} filter mongodb filter
	 * @returns {Promise<integer>} Count of deleted documents
	 */
	async deleteAllDocuments(collection, filter) {

		try {

			const { deletedCount } = await this.mongo.deleteAllDocuments(collection, filter);

			return deletedCount;

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Use aggregates operations on the model collection
	 * @async
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {object[]} stages An array with the pipe's stages to execute (in order to be executed)
	 * @returns {Promise<MongoDocument[]>} Computed results
	 */
	async aggregate(model, stages) {

		if (!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if (!Array.isArray(stages))
			throw new MongoDBError('Invalid aggregation pipes. It must be an array of objects', MongoDBError.codes.INVALID_STAGES);

		const mongoStages = stages.map(pipe => Object.entries(pipe).reduce((acum, [key, value]) => {
			acum[key] = ObjectIdHelper.ensureObjectIdsForWrite(model, value);
			return acum;
		}, {}));

		try {
			const res = await this.mongo.makeQuery(model, collection => collection
				.aggregate(mongoStages).toArray());

			return res.map(item => ObjectIdHelper.mapIdForClient(item));

		} catch (err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}


	/**
	 * @private
	 */
	formatPipelineStage(pipeline) {

		const everyStage = Object.entries(pipeline);

		if (everyStage.every(([key]) => !key.startsWith('$')))
			return this.groupByWriteOperation(pipeline, {});

		if (everyStage.length > 1)
			throw new MongoDBError('Can only be one stage per pipeline', MongoDBError.codes.INVALID_STAGES);

		const [[op, value]] = everyStage;

		return {
			[op]: value
		};
	}

	/**
	 * @private
	 */
	groupByWriteOperation(values, initialValues = {}) {
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

	/**
	 * Returns a function to validate mongoDB id type
	 * @returns {Function}
	 */
	get idStruct() {
		return struct('objectId');
	}
};
