import { mysqlConnectionOptions } from '../../lib/mysql-options.js';
import '../lib/env.mjs';
import mysql from 'mysql2/promise';import {readFile} from 'node:fs/promises';
if(!process.env.MYSQL_URL)throw new Error('MYSQL_URL is required.');
const c=await mysql.createConnection({...mysqlConnectionOptions(),multipleStatements:true});
try{await c.query(await readFile(new URL('../../database/migrations/upgrade-v10.sql',import.meta.url),'utf8'));console.log('V10 settings, user controls and AI storage ready. Existing data preserved.');}finally{await c.end();}
