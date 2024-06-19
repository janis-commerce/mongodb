'use strict';

module.exports = class TestModel {

	static get table() {
		return 'integration-tests';
	}

	static get indexes() {
		return [
			{
				name: 'name',
				key: {
					name: 1
				},
				unique: true
			}
		];
	}

};
