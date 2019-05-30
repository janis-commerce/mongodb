/* eslint-disable */
'use strict';

const MongoDB = require('./index');

const mongodb = new MongoDB({
   host: 'foo',
   user: 'root',
   password: 'foobar',
   database: 'my_db',
   port: 1234
});

async function test() {
   try {
      await mongodb.checkConnection();
   } catch (err) {
      console.error(err.message);
   }
}

test();