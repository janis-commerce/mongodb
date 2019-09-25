'use strict';

class MongoDBFilterWrapper {
	static get filtersAllowed() {
		return {
			equal: '$eq',
			not: '$ne',
			greater: '$gt',
			greaterOrEqual: '$gte',
			lesser: '$lt',
			lesserOrEqual: '$lte',
			in: '$in',
			notIn: '$nin',
			reg: '$regex',
			all: '$all'
		};
	}

	/**
		* Enter door to filter process
		* @param {Object} model Model that will use the filter
		* @param {Object} filters Filters defined as parameters
		* @returns {Object} with the filter parsed
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
		* @param {Object} filters Filters defined as parameters
		* @param {Object} modelFields Model that will use the filter
		* @returns {Array|Object} The filter parsed to use in MongoDB
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
					? [...parsedFilters, fullyParsedFilter] : Object.assign(parsedFilters, fullyParsedFilter);
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
		* @param {Object} filters One filter given with her type and value(only uses that info)
		* @param {Object} modelFields Model that will use the filter if exists
		* @returns {Object} The filter parsed with all the values by one
		*/
	static parseObjectFilter(filters, modelFields) {
		const filterToResponse = {};

		for(const [field, value] of Object.entries(filters)) {
			const fieldName = this.getFieldToCompare(field, modelFields);

			const filter = (typeof value !== 'object') ? { value } : value;

			filterToResponse[fieldName] = this.createFilter(filter, modelFields[field]);
		}
		return filterToResponse;
	}

	/**
		* Creates the object or the value(string/array) to use in the filter
		* @param {Object} filter Filter given as parameter to parse with type and value
		* @param {Object} modelFields Model field that will use the filter, if exists
		* @returns {string|Object} Value to use in filter, with type or if is an equal only the value to
		* search
		*/
	static createFilter(filter, modelFields) {
		const type = this.getFilterType(filter, modelFields);
		const value = this.getValue(filter);

		if(type === 'equal' || !this.filtersAllowed[type])
			return value;

		return {
			[this.filtersAllowed[type]]: value
		};
	}

	/**
		* Gets the value to use in the filter, if is a object(suppose ID) transform to string
		* else search that exists the key value to return, or only returns an empty string
		* @param {Object} filter With all the filter
		* @returns {string|number|object|array} With the value to filter
		*/
	static getValue(filter) {
		let value = '';

		if(typeof filter === 'object' && filter.value === undefined)
			value = filter.toString();

		if(filter.value !== undefined)
			({ value } = filter);

		return value;
	}

	/**
		* Transforms the type given in the filter to a filter used in MongoDB
		* @param {Object} filter Filter by params to use
		* @param {Object} modelField Model fields
		* @returns {string} MongoDB type
		*/
	static getFilterType(filter, modelField) {
		let type = 'equal';

		if(filter && filter.type !== undefined)
			({ type } = filter);
		else if(modelField && modelField.type !== undefined)
			({ type } = modelField);

		return type;
	}

	/**
		* Returns the field to use in filter, if is defined in the Model returns
		* the field set, else returns the col given in the filter
		* @param {String} fieldName Field defined in params
		* @param {Object} modelField Model fields to compare key by fieldName
		* @returns {string} Field to use in filter, if exists in Model returns it else will be used as it comes
		*/
	static getFieldToCompare(fieldName, modelField) {
		return (modelField[fieldName] && modelField[fieldName].field) ? modelField[fieldName].field : fieldName;
	}
}

module.exports = MongoDBFilterWrapper;
