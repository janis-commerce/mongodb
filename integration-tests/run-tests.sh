#!/bin/bash

DIR=`dirname $(readlink -f $0)`

runTest() {

	echo "Running integration tests with mongodb server v$1..."

	# Startup
	MONGODB_VERSION=$1 MONGO_CLI_TOOL=$2 docker compose --project-directory $DIR up --detach

	# Wait until runner ends
	docker compose --project-directory $DIR logs --follow test-runner

	# Shutdown test environment
	docker compose --project-directory $DIR down
}

runTest 6
echo ''

runTest 5
echo ''

runTest 4.4 mongo
echo ''
