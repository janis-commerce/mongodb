/* eslint-disable no-console */

'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

const { MongoMemoryServer } = require('mongodb-memory-server');

const DEFAULT_VERSIONS = ['8.0.12', '7.0.21', '6.0.24'];

const MOCHA_BIN = path.join(__dirname, '..', 'node_modules', '.bin', 'mocha');
const FIXTURES_PATH = path.join(__dirname, 'fixtures');
const BOOTSTRAP_PATH = path.join(__dirname, 'fixtures', '_bootstrap');

/**
 * Runs the mocha integration suite in a dedicated child process against the given MongoDB URI.
 * A separate process is required because `MongoWrapper` caches clients by connection string and
 * there's no way to close them: each server version needs its own process to fully release its client.
 *
 * @param {string} uri The MongoDB connection URI to run the suite against
 * @param {string} version The MongoDB server version, exposed to the fixtures as `MONGODB_INTEGRATION_VERSION`
 * @returns {Promise<number>} The mocha process exit code
 */
const runMochaAgainst = (uri, version) => new Promise(resolve => {

	const mochaProcess = spawn(MOCHA_BIN, ['--exit', '--recursive', '--require', BOOTSTRAP_PATH, FIXTURES_PATH], {
		stdio: 'inherit',
		env: {
			...process.env,
			MONGODB_INTEGRATION_URI: uri,
			MONGODB_INTEGRATION_VERSION: version,
			AWS_LAMBDA_FUNCTION_NAME: 'TestLambdaFunction'
		}
	});

	mochaProcess.on('close', code => resolve(code ?? 1));

	mochaProcess.on('error', err => {
		console.error('Failed to spawn mocha process:', err);
		resolve(1);
	});
});

(async () => {

	const versions = (process.env.MONGODB_VERSIONS || DEFAULT_VERSIONS.join(',')).split(',').map(version => version.trim());

	const results = [];

	for(const version of versions) {

		console.log(`\n${'='.repeat(60)}`);
		console.log(`MongoDB ${version}`);
		console.log('='.repeat(60));

		const mongod = await MongoMemoryServer.create({ binary: { version } });

		try {
			const exitCode = await runMochaAgainst(mongod.getUri('integration-tests'), version);
			results.push({ version, exitCode });
		} finally {
			await mongod.stop();
		}
	}

	console.log(`\n${'='.repeat(60)}`);
	console.log('Integration tests summary');
	console.log('='.repeat(60));

	results.forEach(({ version, exitCode }) => {
		console.log(`MongoDB ${version}: ${exitCode === 0 ? 'PASSED' : 'FAILED'}`);
	});

	const hasFailures = results.some(({ exitCode }) => exitCode !== 0);

	process.exit(hasFailures ? 1 : 0);

})().catch(err => {
	console.error(err);
	process.exit(1);
});
