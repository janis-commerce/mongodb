'use strict';

const FunctionAsFilter = require('./function-as-filter');

class DateToString extends FunctionAsFilter {

	/**
	 * Transforms dateToString filter to DateToString mongo function
	 *
	 * @override
	 * @static
	 * @param {string} fieldKey The field key
	 * @param {object} fieldValue The field value
	 * @returns {object} The processed filter
	 */
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
	}

	/**
	 * Validates required fields
	 *
	 * @static
	 * @param {string} fieldKey The field key
	 * @param {object} fieldValue The field value
	 */
	static validate(fieldKey, fieldValue) {
		if(!fieldValue.format)
			throw new Error(`${fieldKey} must have a valid format property`);
	}
}

module.exports = DateToString;
