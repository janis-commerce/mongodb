'use strict';

/**
 * Resolves the comment to tag DB operations with, based on the AWS Lambda execution env vars
 *
 * @returns {string|undefined} `AWS_LAMBDA_FUNCTION_NAME`, `AWS_LAMBDA_FUNCTION_NAME@AWS_LAMBDA_REQUEST_ID`,
 * `unknown@AWS_LAMBDA_REQUEST_ID` or `undefined` if no env var is set
 */
const getComment = () => {

	const { AWS_LAMBDA_FUNCTION_NAME: functionName, AWS_LAMBDA_REQUEST_ID: requestId } = process.env;

	if(!functionName && !requestId)
		return;

	if(!requestId)
		return functionName;

	return `${functionName || 'unknown'}@${requestId}`;
};

/**
 * Spread-ready version of {@link getComment} for the driver's options objects
 *
 * @returns {{ comment: string }|undefined} `{ comment }` or `undefined` if there is no comment to set
 */
const getCommentOption = () => {
	const comment = getComment();
	return comment && { comment };
};

module.exports = { getComment, getCommentOption };
