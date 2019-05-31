/* eslint-disable */
'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');

const MongoDB = require('./index');

const mongod = new MongoMemoryServer();

(async function(){
   const uri = await mongod.getConnectionString();
   const port = await mongod.getPort();
   const dbPath = await mongod.getDbPath();
   const dbName = await mongod.getDbName();

   console.log(uri, port, dbPath, dbName);
});

/* const mongodb = new MongoDB({
   host: '127.0.0.1',
   port: 3306,
   database: 'myDB',
   user: 'root',
   password: ''
}); */