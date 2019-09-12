'use strict';

class MongoDBFilterWrapper {
	static get filtersAllowed() {
		return {
			notEqual: '$not',
			greater: '$gt',
			greaterOrEqual: '$gte',
			lesser: '$lt',
			lesserOrEqual: '$lte'
		};
	}

	static process(model, filters) {
		const filtersToReturn = {};
		// eslint-disable-next-line guard-for-in,no-restricted-syntax
		for(const aFilter in filters) {
			const conditionFilter = (model.constructor && model.constructor.fields) ? model.constructor.fields[aFilter] : '';
			if(conditionFilter && conditionFilter.type !== undefined) {
				// MongoDBFilterWrapper.filtersAllowed.indexOf(aFilter);
				const mongoCond = MongoDBFilterWrapper.filtersAllowed[conditionFilter.type];
				if(mongoCond) {
					const filterCol = conditionFilter.field ? conditionFilter.field : aFilter;
					const aUse = {
						[mongoCond]: filters[aFilter]
					};
					filtersToReturn[filterCol] = aUse;
				}
			}
		}

		return filtersToReturn;
	}

}

module.exports = MongoDBFilterWrapper;
