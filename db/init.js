require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'inventory_db';

async function hasUniqueIndex(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
       AND non_unique = 0`,
    [table, column]
  );
  return parseInt(rows[0].count, 10) > 0;
}

async function addUniqueIndexIfMissing(connection, table, column, indexName) {
  try {
    if (await hasUniqueIndex(connection, table, column)) return;
    await connection.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${indexName}\` (\`${column}\`)`);
    console.log(`Added unique index ${indexName} on ${table}.${column}.`);
  } catch (err) {
    console.warn(`Could not add unique index on ${table}.${column}: ${err.message}`);
  }
}

async function migrateExistingData(connection) {
  // Collapse duplicate seed locations, re-pointing items and movements to the kept row.
  await connection.query(`
    UPDATE items i
    JOIN locations l ON l.id = i.location_id
    JOIN (SELECT name, MIN(id) AS keep_id FROM locations GROUP BY name) k ON k.name = l.name
    SET i.location_id = k.keep_id
    WHERE i.location_id <> k.keep_id
  `);

  await connection.query(`
    UPDATE movements m
    JOIN locations l ON l.id = m.location_id
    JOIN (SELECT name, MIN(id) AS keep_id FROM locations GROUP BY name) k ON k.name = l.name
    SET m.location_id = k.keep_id
    WHERE m.location_id <> k.keep_id
  `);

  await connection.query(`
    DELETE l FROM locations l
    JOIN (SELECT name, MIN(id) AS keep_id FROM locations GROUP BY name) k ON k.name = l.name
    WHERE l.id <> k.keep_id
  `);

  await connection.query(`
    DELETE s FROM suppliers s
    JOIN (SELECT name, MIN(id) AS keep_id FROM suppliers GROUP BY name) k ON k.name = s.name
    WHERE s.id <> k.keep_id
  `);

  await addUniqueIndexIfMissing(connection, 'locations', 'name', 'uq_locations_name');
  await addUniqueIndexIfMissing(connection, 'suppliers', 'name', 'uq_suppliers_name');
}

async function main() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs
    .readFileSync(schemaPath, 'utf8')
    .split('inventory_db')
    .join(DB_NAME.replace(/`/g, ''));

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log(`Connecting to MySQL at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306} ...`);

  try {
    const [results] = await connection.query(sql);
    const resultSets = Array.isArray(results) ? results.flat() : [results];
    const message = resultSets.reverse().find((row) => row && row.Message);

    await connection.query(`USE \`${DB_NAME.replace(/`/g, '')}\``);
    await migrateExistingData(connection);

    console.log(message ? message.Message : 'Database schema loaded successfully.');
    console.log('Existing duplicate seed data was merged where possible.');
    console.log('Default accounts are created when the server starts for the first time.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('\nDatabase initialization failed:', err.message);
  console.error('Make sure MySQL/XAMPP is running and the DB settings in .env are correct.');
  process.exit(1);
});
