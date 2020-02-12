'use strict';

const MongoDBFilters = require('./mongodb-filters');
const FunctionAsFilter = require('./helpers/functions-types/function-as-filter');
const FunctionsTypes = require('./helpers/functions-types');

class MongoDBAggregationFilters extends MongoDBFilters {

	/**
	 * Get filter types
	 * @override
	 * @readonly
	 * @static
	 */
	static get filterTypes() {
		return {
			maximun: '$max',
			minimun: '$min',
			average: '$avg',
			first: '$first',
			last: '$last',
			multiply: '$multiply',
			sum: '$sum',
			addToSet: '$addToSet',
			...super.filterTypes
		};
	}

	/**
	 * Get function types
	 * @override
	 * @readonly
	 * @static
	 */
	static get functionTypes() {
		return FunctionsTypes;
	}

	/**
	 * Parses a filter group item (AND-condition filters)
	 *
	 * @override
	 * @static
	 * @param {object} filterGroupItem The filter group item
	 * @param {object} modelFields The model fields definition
	 * @return {Object} The parsed filter key and filter value
	 */
	static parseFilterGroupItem(filterGroupItem, modelFields) {
		const [filterName, filterData] = filterGroupItem;
		const functionClass = this.functionTypes[filterData.type];

		if(!functionClass)
			return super.parseFilterGroupItem(filterGroupItem, modelFields);

		return this._parseWithFunctionClass(filterName, filterData, functionClass);

	}

	/**
	 * Parses a filter as mongodb function
	 *
	 * @static
	 * @param {object} filterName Name of filter
	 * @param {object} filterData Data of filter
	 * @param {object} functionClass Class to use to process the filter
	 * @return {Object} The parsed filter key and filter value
	 */
	static _parseWithFunctionClass(filterName, filterData, functionClass) {
		if(!filterName)
			throw new Error('Filter name is required');

		const isValidFilterDataType = typeof filterData === 'object' && filterData.type;
		const isValidFunctionClass = functionClass && functionClass.prototype instanceof FunctionAsFilter;

		if(!isValidFilterDataType)
			throw new Error('Filter type is required');

		if(!isValidFunctionClass)
			throw new Error(`${filterData.type} must inherit from FunctionAsFilter class`);

		const { key, value } = functionClass.parse(filterName, filterData);
		return { filterKey: key, filterValue: value };
	}

	/**
	 * Parses a filter as mongodb function
	 *
	 * @override
	 * @static
	 * @param {object} filterData Data of filter
	 * @param {object} modelField The model fields definition
	 * @return {Object} The parsed filter value
	 */
	static getFilterValue(filterData, modelField) {
		const superFilterValue = super.getFilterValue(filterData, modelField);
		return `$${superFilterValue}`;
	}
}

module.exports = MongoDBAggregationFilters;
