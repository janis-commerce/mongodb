'use strict';

const MongoDBFilters = require('./mongodb-filters');
const ObjectIdHelper = require('./helpers/object-id');

class MongoDBFilterFunction {
	static parse(fieldKey, fieldValue) {
		this.validate(fieldKey, fieldValue);
		return this.transform(fieldKey, fieldValue);
	}

	static validate(fieldValue) {
		if(fieldValue)
			return true;
	}
}

class DateToString extends MongoDBFilterFunction {

	static transform(fieldKey, fieldValue) {
		const dateField = fieldValue.value || fieldKey;
		return {
			key: fieldKey,
			value: {
				$dateToString: {
					format: fieldValue.format,
					date: `$${dateField}`
				}
			}
		};
		// dateCreated: {$dateToString: {format: "%Y-%m-%d", date: "$dateCreated"}}
	}

	static validate(fieldKey, fieldValue) {

		if(!fieldValue)
			throw new Error(`${fieldKey} has not a valid value`);

		if(!fieldValue.format)
			throw new Error(`${fieldKey} must have a valid format property`);
	}
}

class MongoDBAggregationFilters extends MongoDBFilters {

	static get filterTypes() {
		return {
			maximun: '$max',
			minimun: '$min',
			average: '$avg',
			first: '$first',
			multiply: '$multiply',
			sum: '$sum'
		};
	}

	static get functionTypes() {
		return {
			dateToString: DateToString
		};
	}

	static parseFilterGroupItem(filterGroupItem, modelFields) {
		const [filterName, filterData] = filterGroupItem;
		const functionClass = this.functionTypes[filterData.type];
		if(typeof filterData === 'object' && filterData.type && functionClass) {
			if(!(functionClass.prototype instanceof MongoDBFilterFunction))
				throw new Error(`${filterData.type} must inherit from MongoDBFilterFunction class`);
			const { key, value } = functionClass.parse(filterName, filterData);
			return { filterKey: key, filterValue: value };
		}

		return super.parseFilterGroupItem(filterGroupItem, modelFields);
	}

	static getFilterValue(filterData, modelField) {
		const superValue = super.getFilterValue(filterData, modelField);
		return `$${superValue}`;
		// dateCreated: {$dateToString: {format: "%Y-%m-%d", date: "$dateCreated"}}}
	}
}


class MongoDBAggregate {

	constructor(model) {
		this._model = model;
		this._pipeline = [];
	}

	get pipeline() {
		return this._pipeline;
	}


	group(fields, by) {
		const defaultStruct = {};

		if(fields && fields.values)
			throw new Error('"values" field name is reserved word');

		let columns;
		if(typeof fields === 'object' && Object.keys(fields).length > 0)
			columns = MongoDBAggregationFilters.parseFilters(fields, this._model);
		else
			columns = { values: { $push: '$$ROOT' } };

		const _id = by.reduce((accumulator, element) => {
			if(typeof element === 'object') {
				element = MongoDBAggregationFilters.parseFilters(element, this._model);
				accumulator = { ...element, ...accumulator };
			} else
				accumulator[element] = `$${element}`;
			return accumulator;
		}, defaultStruct);

		const groupQuery = { $group: { _id, ...columns } };

		this._pipeline.unshift(groupQuery);
		return this;
	}

	limit(quantity) {
		if(quantity && quantity > 0) {
			const limitQuery = { $limit: quantity };
			this._pipeline.push(limitQuery);
		}
		return this;
	}

	having(havingFilters) {
		// { $match: { values: { $elemMatch: { quantity:{ $gte: 1 } } }  } }
		if(havingFilters && Object.keys(havingFilters).length > 0) {
			const parsedHaving = MongoDBFilters.parseFilters(ObjectIdHelper.ensureObjectIdsForWrite(this._model, havingFilters || {}), this._model);
			const pipelineGroupElement = this._pipeline.find(element => element.$group) || {};
			const group = pipelineGroupElement.$group || {};
			const havingQuery = { $match: {} };
			if(group.values)
				havingQuery.$match = { values: { $elemMatch: { ...parsedHaving } } };
			else
				havingQuery.$match = { ...parsedHaving };
			this._pipeline.push(havingQuery);
		}
		return this;
	}
}

module.exports = MongoDBAggregate;
