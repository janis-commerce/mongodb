'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { getComment, getCommentOption } = require('../lib/helpers/operation-comment');

describe('Helpers - Operation comment', () => {

	const stubEnv = env => {
		const { AWS_LAMBDA_FUNCTION_NAME, AWS_LAMBDA_REQUEST_ID, ...cleanEnv } = process.env;
		sinon.stub(process, 'env').value({ ...cleanEnv, ...env });
	};

	afterEach(() => {
		sinon.restore();
	});

	describe('getComment()', () => {

		it('Should return undefined if no env var is set', () => {
			stubEnv({});
			assert.strictEqual(getComment(), undefined);
		});

		it('Should return the function name if only AWS_LAMBDA_FUNCTION_NAME is set', () => {
			stubEnv({ AWS_LAMBDA_FUNCTION_NAME: 'MyLambdaFunction' });
			assert.strictEqual(getComment(), 'MyLambdaFunction');
		});

		it('Should return functionName@requestId if both env vars are set', () => {
			stubEnv({ AWS_LAMBDA_FUNCTION_NAME: 'MyLambdaFunction', AWS_LAMBDA_REQUEST_ID: 'test-request-id' });
			assert.strictEqual(getComment(), 'MyLambdaFunction@test-request-id');
		});

		it('Should return unknown@requestId if only AWS_LAMBDA_REQUEST_ID is set', () => {
			stubEnv({ AWS_LAMBDA_REQUEST_ID: 'test-request-id' });
			assert.strictEqual(getComment(), 'unknown@test-request-id');
		});

		it('Should treat empty env vars as not set', () => {
			stubEnv({ AWS_LAMBDA_FUNCTION_NAME: 'MyLambdaFunction', AWS_LAMBDA_REQUEST_ID: '' });
			assert.strictEqual(getComment(), 'MyLambdaFunction');
		});
	});

	describe('getCommentOption()', () => {

		it('Should return undefined if no env var is set', () => {
			stubEnv({});
			assert.strictEqual(getCommentOption(), undefined);
		});

		it('Should return a spread-ready object with the comment if any env var is set', () => {
			stubEnv({ AWS_LAMBDA_FUNCTION_NAME: 'MyLambdaFunction', AWS_LAMBDA_REQUEST_ID: 'test-request-id' });
			assert.deepStrictEqual(getCommentOption(), { comment: 'MyLambdaFunction@test-request-id' });
		});
	});
});
