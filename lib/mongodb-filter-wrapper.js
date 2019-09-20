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
		* @param modelFields Object Model that will use the filter
		* @param filters Object Filters defined as parameters
		* @returns {{$or}|{}} Object with the filter parsed
		*/
	static process(modelFields, filters) {
		let modelFilters = {};

		// Get model filters
		if(modelFields.constructor && modelFields.constructor.fields)
			modelFilters = modelFields.constructor.fields;

		// Get model filters
		if(typeof filters !== 'object' || filters.length === 0)
			return {};

		return this.getParsedFilters(filters, modelFilters);
	}

	/**
		* Validates filters given and loop calling to parse
		* @returns parsedFilters Array|Object The filter parsed to use in MongoDB
		* @param filters Object Filters defined as parameters
		* @param modelFields Object Model that will use the filter
		*/
	static getParsedFilters(filters, modelFields) {
		let orCondition = false;

		if(Array.isArray(filters))
			orCondition = true;

		let parsedFilters = orCondition ? [] : {};

		// Only arrays as a filter
		if(filters !== undefined && typeof filters === 'object' && Object.keys(filters).length > 0 && !Array.isArray(filters))
			filters = [filters];

		if(filters && Array.isArray(filters) && filters.length > 0) {
			// First loop over all filters given by parameters
			filters.forEach(filterGiven => {
				const fullyParsedFilter = this.parseObjectFilter(filterGiven, modelFields);
				parsedFilters = (orCondition && Array.isArray(parsedFilters))
					? [...parsedFilters, fullyParsedFilter] : Object.assign(parsedFilters, fullyParsedFilter);
			});
		}

		if(orCondition && parsedFilters.length > 0) {
			return {
				$or: parsedFilters
			};
		}

		return parsedFilters;
	}

	/**
		* Parse the filter comparing given fields name and model fields
		* @param filters Object Filters defined as parameters
		* @param modelFields Object Model that will use the filter
		* @return filterToResponse Object The filter parsed with all the values by one
		*/
	static parseObjectFilter(filters, modelFields) {
		const filterToResponse = {};

		for(const [field] of Object.entries(filters)) {
			const fieldName = this.getFieldToCompare(field, modelFields);

			const value = (typeof filters[field] !== 'object') ? { value: filters[field] } : filters[field];

			filterToResponse[fieldName] = this.createFilter(value, modelFields[field]);
		}
		return filterToResponse;
	}

	/**
		* Creates the object or the value(string/array) to use in the filter
		* @returns {string|Object} Value to use in filter, with type or if is an equal only the value to
		* search
		* @param filter Object Filters defined as parameters
		* @param modelFields Object Model that will use the filter
		*/
	static createFilter(filter, modelFields) {
		const type = this.getFilterType(filter, modelFields);
		const value = this.getValue(filter);

		if(type === 'equal')
			return value;

		return {
			[this.filtersAllowed[type]]: value
		};
	}

	/**
		* Gets the value to use in the filter, if is a object(suppose ID) transform to string
		* else search that exists the key value to return, or only returns an empty string
		* @returns value String With the value to filter
		* @param filter Object With all the filter
		*/
	static getValue(filter) {
		let value = '';

		if(typeof filter === 'object' && filter.value === undefined)
			value = filter.str;

		if(filter.value !== undefined)
			({ value } = filter);

		return value;
	}

	/**
		* Transforms the type given in the filter to a filter used in MongoDB
		* @returns type string MongoDB type
		* @param filter Object Filter by params to use
		* @param modelField Object Model fields
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
		* the field setted, else returns the col given in the filter
		* @returns {string} Field to use in filter, if exists in Model returns it else will be used as it comes
		* @param fieldName String Field defined in params
		* @param modelField Object Model fields to compare key by fieldName
		*/
	static getFieldToCompare(fieldName, modelField) {
		return (modelField[fieldName] && modelField[fieldName].field) ? modelField[fieldName].field : fieldName;
	}
}

module.exports = MongoDBFilterWrapper;
