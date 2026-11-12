import { mysqlConnectionOptions } from '../../lib/mysql-options.js';
import '../lib/env.mjs';
import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const identifier = value => {
  if (!/^[a-z][a-z0-9_]*$/i.test(value)) throw new Error('Invalid index identifier.');
  return `\`${value}\``;
};

export async function optimizeDatabaseIndexes(connection, {dryRun = false, log = console.log} = {}) {
  const definitions = JSON.parse(await readFile(new URL('../../database/indexes.json', import.meta.url), 'utf8'));
  const [rows] = await connection.query(`SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName,
    COLUMN_NAME AS columnName, SUB_PART AS prefixLength, NON_UNIQUE AS nonUnique, INDEX_TYPE AS indexType
    FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`);
  const indexes = new Map();
  for (const row of rows) {
    const key = `${row.tableName}.${row.indexName}`;
    const index = indexes.get(key) ?? {table:row.tableName, name:row.indexName, columns:[], nonUnique:row.nonUnique, complete:true};
    index.columns.push(row.columnName);
    index.complete &&= row.prefixLength === null && row.indexType === 'BTREE';
    indexes.set(key, index);
  }
  const [columnRows] = await connection.query('SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE()');
  const columns = new Set(columnRows.map(row => `${row.tableName}.${row.columnName}`));
  for (const definition of definitions) {
    identifier(definition.table);identifier(definition.name);definition.columns.forEach(identifier);
    if (![...indexes.values()].some(index => index.table === definition.table)) {
      throw new Error(`Missing table ${definition.table}; initialize/upgrade the schema first.`);
    }
    for (const column of definition.columns) {
      if (!columns.has(`${definition.table}.${column}`)) throw new Error(`Missing column ${definition.table}.${column}; upgrade the schema first.`);
    }
  }
  const statements = [];
  for (const definition of definitions) {
    const covered = [...indexes.values()].some(index => index.table === definition.table && index.complete && definition.columns.every((column, position) => index.columns[position] === column));
    if (covered) continue;
    const key = `${definition.table}.${definition.name}`;
    if (indexes.has(key)) throw new Error(`Index ${key} exists with a different definition; review it manually.`);
    const sql = `ALTER TABLE ${identifier(definition.table)} ADD INDEX ${identifier(definition.name)} (${definition.columns.map(identifier).join(', ')})`;
    if (!dryRun) await connection.query(sql);
    log(`${dryRun ? 'Would apply' : 'Applied'}: ${definition.table}.${definition.name}`);
    statements.push(sql);
    indexes.set(key, {...definition, complete:true, nonUnique:1});
  }
  // Only remove the three non-unique single-column indexes replaced by the new composites.
  for (const [table, name, column] of [['listings','listing_owner','owner_external_id'], ['community_comments','post_id','post_id'], ['notifications','user_id','user_id']]) {
    const key = `${table}.${name}`;
    const old = indexes.get(key);
    const covered = [...indexes.values()].some(index => index.table === table && index.name !== name && index.complete && index.columns[0] === column);
    if (!old || old.nonUnique !== 1 || old.columns.length !== 1 || old.columns[0] !== column || !covered) continue;
    const sql = `ALTER TABLE ${identifier(table)} DROP INDEX ${identifier(name)}`;
    if (!dryRun) await connection.query(sql);
    log(`${dryRun ? 'Would remove redundant index' : 'Removed redundant index'}: ${key}`);
    statements.push(sql);indexes.delete(key);
  }
  log(`${dryRun ? 'Planned' : 'Completed'} ${statements.length} index changes. No rows or columns were modified.`);
  return statements;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.env.MYSQL_URL?.trim()) throw new Error('MYSQL_URL is required.');
  const connection = await mysql.createConnection(mysqlConnectionOptions());
  try {await optimizeDatabaseIndexes(connection, {dryRun:process.argv.includes('--dry-run')});}
  finally {await connection.end();}
}
