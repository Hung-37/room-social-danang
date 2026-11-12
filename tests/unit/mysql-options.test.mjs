import test from 'node:test';
import assert from 'node:assert/strict';
import { mysqlConnectionOptions } from '../../lib/mysql-options.js';
const MYSQL_URL='mysql://user:password@example.com/db';
test('local connection retains URI without forcing TLS',()=>{
 assert.deepEqual(mysqlConnectionOptions({MYSQL_URL}),{uri:MYSQL_URL});
});
test('cloud TLS verifies certificates and expands PEM newlines',()=>{
 assert.deepEqual(mysqlConnectionOptions({MYSQL_URL,MYSQL_SSL:'true',MYSQL_SSL_CA:'CERT\\nEND'}).ssl,{rejectUnauthorized:true,ca:'CERT\nEND'});
 assert.equal(mysqlConnectionOptions({MYSQL_URL,MYSQL_SSL:'true'}).ssl.rejectUnauthorized,true);
});
test('invalid TLS configuration fails before connecting',()=>{
 assert.throws(()=>mysqlConnectionOptions({MYSQL_URL,MYSQL_SSL:'false',MYSQL_SSL_CA:'CA'}));
 assert.throws(()=>mysqlConnectionOptions({MYSQL_URL,MYSQL_SSL:'typo'}));
 assert.throws(()=>mysqlConnectionOptions({MYSQL_URL,MYSQL_SSL_CA_PATH:'missing-ca-file.pem'}));
 assert.throws(()=>mysqlConnectionOptions({}));
});
