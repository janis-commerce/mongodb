'use strict';

const MongoDBFilters = require('./mongodb-filters');
const ObjectIdHelper = require('./helpers/object-id');

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

	static getFilterValue(filterData, modelField) {
		const superValue = super.getFilterValue(filterData, modelField);
		return `$${superValue}`;
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

	_dateFormatter(element) {
		const [key] = Object.keys(element);

		if(!key)
			return '';
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
