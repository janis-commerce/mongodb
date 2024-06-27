/* eslint-disable no-console */

'use strict';

const { readdir } = require('node:fs/promises');

const Mocha = require('mocha');

const mocha = new Mocha();

(async () => {

	const fixtures = (await readdir('./fixtures')).filter(fileName => !fileName.startsWith('_'));

	fixtures.forEach(fixture => {
		mocha.addFile(`./fixtures/${fixture}`);
	});

	// Set to false to avoid mixing tests DB data
	mocha.parallelMode(false);

	mocha.run(failures => {
		process.exit(failures ? 1 : 0);
	});

})();
