'use strict';

const MongoDBFilters = require('./mongodb-filters');
const MongoDBAggregationFilters = require('./mongodb-aggregation-filters');

class MongoDBAggregate {

	constructor(model) {
		this._model = model;
		this._pipeline = [];
	}

	get pipeline() {
		return this._pipeline;
	}


	group(fields, by) {

		if(fields && fields.values)
			throw new Error('"values" field name in "fields" is reserved word');

		const groupFields = this._makeGroupFields(fields);
		const _id = this._makeGroupBy(by);
		const groupQuery = { $group: { _id, ...groupFields } };

		this._pipeline.unshift(groupQuery);

		return this;
	}

	_makeGroupFields(fields) {

		if(typeof fields === 'object' && Object.keys(fields).length > 0)
			return MongoDBAggregationFilters.parseFilters(fields, this._model);

		return { values: { $push: '$$ROOT' } };
	}

	_makeGroupBy(arrayBy) {
		if(!Array.isArray(arrayBy))
			return null;

		const defaultStruct = {};
		return arrayBy.reduce((accumulator, element) => {
			if(typeof element === 'object') {
				element = MongoDBAggregationFilters.parseFilters(element, this._model);
				accumulator = { ...element, ...accumulator };
			} else
				accumulator[element] = `$${element}`;

			return accumulator;
		}, defaultStruct);
	}

	limit(quantity) {
		if(quantity && quantity > 0) {
			const limitQuery = { $limit: quantity };
			this._pipeline.push(limitQuery);
		}
		return this;
	}

	having(havingFilters) {
		const hasHavingFilters = havingFilters && Object.keys(havingFilters).length > 0;

		if(!hasHavingFilters)
			return this;

		const parsedHaving = MongoDBFilters.parseFilters(havingFilters, this._model);
		const pipelineGroupElement = this._pipeline.find(element => element.$group) || {};
		const isGroupedByAllFields = pipelineGroupElement.$group && pipelineGroupElement.$group.values;
		const havingQuery = this._makeHavingQuery(parsedHaving, isGroupedByAllFields);

		this._pipeline.push(havingQuery);

		return this;
	}

	_makeHavingQuery(parsedHaving, isGroupedByAllFields) {
		if(isGroupedByAllFields)
			return { $match: { values: { $elemMatch: { ...parsedHaving } } } };
		return { $match: { ...parsedHaving } };
	}
}

module.exports = MongoDBAggregate;
