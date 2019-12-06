'use strict';

const { ObjectID } = require('mongodb');

const MongoDBError = require('./mongodb-error');

class MongoDBFilterWrapper {

	static get filtersAllowed() {
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
	 * Enter door to filter process
	 *
	 * @param {Object} model Model that will use the filter
	 * @param {Object} filters Filters defined as parameters
	 * @return {Object} with the filter parsed
	 */
	static process(model, filters) {

		// Validate filters given
		if(typeof filters !== 'object' || (Array.isArray(filters) && !filters.length) || !Object.entries(filters).length)
			return {};

		// Get model filters
		const modelFields = model.constructor.fields || {};

		return this.getParsedFilters(filters, modelFields);
	}

	/**
	 * Validates filters given and loop calling to parse
	 *
	 * @param {Object} filters Filters defined as parameters
	 * @param {Object} modelFields Model that will use the filter
	 * @return {Array|Object} The filter parsed to use in MongoDB
	 */
	static getParsedFilters(filters, modelFields) {
		const orCondition = Array.isArray(filters);

		let parsedFilters = orCondition ? [] : {};

		// Only arrays as a filter
		if(typeof filters === 'object' && !Array.isArray(filters) && Object.keys(filters).length)
			filters = [filters];

		if(filters && filters.length) {
			// First loop over all filters given by parameters
			filters.forEach(filterGiven => {
				const fullyParsedFilter = this.parseObjectFilter(filterGiven, modelFields);
				parsedFilters = (orCondition)
					? [...parsedFilters, fullyParsedFilter] : { ...parsedFilters, ...fullyParsedFilter };
			});
		}

		if(orCondition && parsedFilters.length) {
			return {
				$or: parsedFilters
			};
		}

		return parsedFilters;
	}

	/**
	 * Parse the filter comparing given fields name and model fields
	 *
	 * @param {Object} filters One filter given with her type and value (only uses that info)
	 * @param {Object} modelFields Model that will use the filter if exists
	 * @return {Object} The filter parsed with all the values by one
	 */
	static parseObjectFilter(filters, modelFields) {
		const filterToResponse = {};

		for(const [field, value] of Object.entries(filters)) {
			const fieldName = this.getFieldToCompare(field, modelFields);

			const filter = (typeof value !== 'object' || Array.isArray(value)) ? { value } : value;

			filterToResponse[fieldName] = this.createFilter(filter, modelFields[field], filterToResponse);
		}
		return filterToResponse;
	}


	/**
	 * Returns the field to use in filter, if is defined in the Model returns the field set, else returns the col given in the filter
	 *
	 * @param {String} fieldName Field defined in params
	 * @param {Object} modelField Model fields to compare key by fieldName
	 * @return {string} Field to use in filter, if exists in Model returns it else will be used as it comes
	 */
	static getFieldToCompare(fieldName, modelField) {
		return (modelField[fieldName] && modelField[fieldName].field) ? modelField[fieldName].field : fieldName;
	}

	/**
	 * Validates if exists another field and merge with and condition
	 *
	 * @param {Object} filter One filter or object given
	 * @param {Object} modelField Model field that use in filters
	 * @param {Object} filterToResponse Filter that will be returned
	 * @return {string|Object} Filter created or merged object
	 */
	static createFilter(filter, modelField, filterToResponse) {

		if(modelField && modelField.field && filterToResponse[modelField.field])
			return { ...this.generateFilter(filter, modelField), ...filterToResponse[modelField.field] };

		return this.generateFilter(filter, modelField);
	}

	/**
	 * Creates the object or the value(string/array) to use in the filter
	 *
	 * @param {Object} filter Filter given as parameter to parse with type and value
	 * @param {Object} modelField Model field that will use the filter, if exists
	 * @return {string|Object} Value to use in filter, with type or if is an equal only the value to search
	 */
	static generateFilter(filter, modelField) {

		const value = this.getValue(filter, modelField);

		const type = this.getFilterType(filter, modelField, Array.isArray(value));

		if(!this.filtersAllowed[type])
			throw new MongoDBError(`Invalid filter type ${type}`, MongoDBError.codes.INVALID_FILTER_TYPE);

		return {
			[this.filtersAllowed[type]]: value
		};
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

	/**
	 * Transforms the type given in the filter to a filter used in MongoDB
	 *
	 * @param {Object} filter Filter by params to use
	 * @param {Object} modelField Model fields
	 * @param {boolean} hasMultipleValues Indicates if the current filter has multiple values
	 * @return {string} MongoDB filter type
	 */
	static getFilterType(filter, modelField, hasMultipleValues) {
		return (filter && filter.type) || (modelField && modelField.type) || (hasMultipleValues ? 'in' : 'equal');
	}

	/**
	 * Gets the value to use in the filter, if is a object(suppose ID) transform to string else search that exists the key value to return, or only returns an empty string
	 *
	 * @param {Object} filter With all the filter
	 * @param {Object} modelField The model field
	 * @return {string|number|object|array} With the value to filter
	 */
	static getValue(filter, modelField) {
		let value = '';

		if(typeof filter === 'object' && filter.value === undefined)
			value = filter.toString();

		if(typeof filter === 'object' && filter instanceof Date)
			value = filter.toISOString();

		if(filter.value !== undefined)
			({ value } = filter);

		value = modelField && modelField.isID ? this.mapToObjectId(value) : value;

		return value;
	}
}

module.exports = MongoDBFilterWrapper;
