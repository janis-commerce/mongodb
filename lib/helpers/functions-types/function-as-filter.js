'use strict';

class FunctionAsFilter {

	/**
	 * Validates and parse filter to mongo function
	 *
	 * @static
	 * @param {string} fieldKey The field key
	 * @param {object} fieldValue The field value
	 * @returns {object} The processed filter
	 */
	static parse(fieldKey, fieldValue) {
		this._validate(fieldKey, fieldValue);
		return this.transform(fieldKey, fieldValue);
	}

	/**
	 * Transforms filter to mongo function
	 *
	 * @static
	 * @param {string} fieldKey The field key
	 * @param {object} fieldValue The field value
	 * @returns {object} The processed filter
	 */
	static transform(fieldKey, fieldValue) {
		return {
			key: fieldKey,
			value: fieldValue
		};
	}

	/**
	 * Validates field values
	 *
	 * @static
	 * @param {string} fieldKey The field key
	 * @param {object} fieldValue The field value
	 */
	static _validate(fieldKey, fieldValue) {
		if(!fieldKey)
			throw new Error('fieldKey is required');

		if(!fieldValue)
			throw new Error(`${fieldKey} has not a valid value`);

		this.validate(fieldKey, fieldValue);

		return true;
	}

	static validate() {
		return true;
	}

}

module.exports = FunctionAsFilter;
