'use strict';

const { inspect } = require('util');

const MongoDBError = require('./mongodb-error');
const { ObjectID } = require('./mongodb-wrapper');

module.exports = class MongoDBFilters {

	static get filterTypes() {
		return {
			equal: '$eq',
			notEqual: '$ne',
			greater: '$gt',
			greaterOrEqual: '$gte',
			lesser: '$lt',
			lesserOrEqual: '$lte',
			in: '$in',
			notIn: '$nin',
			search: '$regex',
			all: '$all',
			exists: '$exists'
		};
	}

	/**
	 * Parses the received filters to mongodb format
	 *
	 * @param {object|array<object>} filters The filters to parse (object is AND condition, array is OR condition)
	 * @param {Model} model The model to use for fields definitions
	 * @return {Object} The parsed filters, ready to be passed to find() method
	 */
	static parseFilters(filters, model) {

		if(filters === undefined)
			return {};

		if(typeof filters !== 'object')
			throw new MongoDBError(`Invalid filters received: ${inspect(filters)}`);

		if((Array.isArray(filters) && !filters.length) || !Object.keys(filters).length)
			return {};

		const modelFields = model.constructor.fields || {};

		const filtersAsArray = Array.isArray(filters) ? filters : [filters];

		const parsedFilters = filtersAsArray.map(filterGroup => this.parseFilterGroup(filterGroup, modelFields));

		return parsedFilters.length === 1 ? parsedFilters[0] : { $or: parsedFilters };
	}

	/**
	 * Parses a filter group (AND-condition filters)
	 *
	 * @param {object} filterGroup The filter group
	 * @param {object} modelFields The model fields definition
	 */
	static parseFilterGroup(filterGroup, modelFields) {

		const parsedFilterGroup = {};

		for(const [filterName, filterData] of Object.entries(filterGroup)) {

			const modelField = typeof modelFields[filterName] === 'object' ? modelFields[filterName] : {};

			const filterKey = this.getFilterFieldName(filterName, modelField);

			const filterValue = this.getFilterValueObject(filterData, modelField);

			parsedFilterGroup[filterKey] = parsedFilterGroup[filterKey] ? { ...parsedFilterGroup[filterKey], ...filterValue } : filterValue;
		}

		return parsedFilterGroup;
	}

	static getFilterFieldName(filterName, modelField) {
		return modelField.field || filterName;
	}

	static getFilterValueObject(filterData, modelField) {

		if(typeof filterData !== 'object' || Array.isArray(filterData) || !filterData.value)
			filterData = { value: filterData };

		const value = this.getFilterValue(filterData, modelField);

		const type = this.getFilterType(filterData, modelField, Array.isArray(value));

		if(!this.filterTypes[type])
			throw new MongoDBError(`Invalid filter type ${type}`, MongoDBError.codes.INVALID_FILTER_TYPE);

		return {
			[this.filterTypes[type]]: value
		};
	}

	static getFilterType(filterData, modelField, hasMultipleValues) {
		return filterData.type || modelField.type || (hasMultipleValues ? 'in' : 'equal');
	}

	static getFilterValue(filterData, modelField) {

		const { value } = filterData;

		if((filterData.type || modelField.type) === 'search')
			return new RegExp(value, 'i');

		return modelField && modelField.isID ? this.mapToObjectId(value) : value;
	}

	/**
	 * Map a value (or array of values) to Mongo Object IDs
	 *
	 * @param {string|array<string>} value The id(s) as string(s)
	 * @return {ObjectID|array<ObjectID>} The id(s) as ObjectID(s)
	 */
	static mapToObjectId(value) {
		return Array.isArray(value) ? value.map(v => ObjectID(v)) : ObjectID(value);
	}

};
