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
		* @param model
		* @param filtersDefined
		* @returns {{$or}|{}}
		*/
	static process(model, filtersDefined) {
		let modelFilters = {};

		// Get model filters
		if(model.constructor && model.constructor.fields)
			modelFilters = model.constructor.fields;

		return MongoDBFilterWrapper.parseFiltersDefined(filtersDefined, modelFilters);
	}

	/**
		* Validates filters given and loop calling to parse
		* @param filtersGiven
		* @param modelFilters
		* @returns {{$or: Array}}
		*/
	static parseFiltersDefined(filtersGiven, modelFilters) {
		let filters = {};
		const filtersArray = [];
		let filtersToLoop = {};
		let orCondition = false;

		if(Array.isArray(filtersGiven))
			orCondition = true;

		// Get only with objects as a filter
		if(filtersGiven !== undefined && typeof filtersGiven === 'object' && Object.keys(filtersGiven).length > 0 && !Array.isArray(filtersGiven))
			filtersToLoop = [filtersGiven];
		else if(filtersGiven !== undefined && Array.isArray(filtersGiven))
			filtersToLoop = filtersGiven;

		if(Array.isArray(filtersToLoop) && filtersToLoop.length > 0) {
			// First loop over all filters given by parameters
			filtersToLoop.forEach(filterGiven => {
				const formedFilter = MongoDBFilterWrapper.parseObjectFilter(filterGiven, modelFilters);

				if(orCondition)
					filtersArray.push(formedFilter);
				else
					filters = Object.assign(filters, formedFilter);

			});
		}

		if(orCondition) {
			return {
				$or: filtersArray
			};
		}

		return filters;
	}

	/**
		* Parse the filter comparing given fields name and model fields
		* @param filterComplete
		* @param modelFilters
		*/
	static parseObjectFilter(filterComplete, modelFilters) {
		const filterToResponse = {};

		// for(const col in filterComplete) {
		for(const [col, value] of Object.entries(filterComplete)) {
			const field = MongoDBFilterWrapper.getFieldToCompare(col, modelFilters);

			if(typeof value === 'object')
				filterToResponse[field] = MongoDBFilterWrapper.createFilter(col, value, modelFilters[col]);
			else
				filterToResponse[field] = MongoDBFilterWrapper.createFilter(col, { value }, modelFilters[col]);
		}
		return filterToResponse;
	}

	/**
		* Creates the object or the value(string/array) to use in the filter
		* @param col
		* @param filterToParse
		* @param modelFilters
		* @returns {string|{}}
		*/
	static createFilter(col, filterToParse, modelFilters) {
		const type = MongoDBFilterWrapper.getFilterType(filterToParse, modelFilters);
		const value = MongoDBFilterWrapper.getValue(filterToParse);

		if(type === 'equal')
			return value;

		return {
			[MongoDBFilterWrapper.filtersAllowed[type]]: value
		};
	}

	/**
		* Gets the value to use in the filter, if is a object(suposse ID) transform to string
		* else search that exists the key value to return, or only returns an empty string
		* @param filterToUse
		* @returns {string}
		*/
	static getValue(filterToUse) {
		let result = '';

		if(typeof filterToUse === 'object' && filterToUse.value === undefined)
			result = filterToUse.str;

		if(filterToUse.value !== undefined)
			result = filterToUse.value;

		return result;
	}

	/**
		* Transforms the type given in the filter to a filter used in MongoDB
		* @param filterComplete
		* @param modelFilters
		* @returns {string}
		*/
	static getFilterType(filterComplete, modelFilters) {
		let type = 'equal';

		if(filterComplete && filterComplete.type !== undefined)
			({ type } = filterComplete);
		else if(modelFilters && modelFilters.type !== undefined)
			({ type } = modelFilters);

		return type;
	}

	/**
		* Returns the field to use in filter, if is defined in the Model returns
		* the field setted, else returns the col given in the filter
		* @param col
		* @param modelFilters
		* @returns {string|filters.field|{type, value}|string}
		*/
	static getFieldToCompare(col, modelFilters) {
		return (modelFilters[col] && modelFilters[col].field) ? modelFilters[col].field : col;
	}
}

module.exports = MongoDBFilterWrapper;
