import { createPool, Pool } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';


dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

let pool: Pool | undefined;

function connectUserDB() {
  if (!pool) {
    try {
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'test'
      ) {
        pool = createPool({
          host: process.env.DEV_HOST,
          user: process.env.DEV_USER_STRING,
          password: process.env.DEV_PASSWORD || '',
          database: process.env.DEV_DATABASE,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
        });
      } else {
        console.log('Database configuration:', {
          host: process.env.HOST,
          user: process.env.USER_STRING,
          database: process.env.DATABASE,
          port: process.env.PORT,
        });
        pool = createPool({
          host: process.env.HOST,
          user: process.env.USER_STRING,
          password: process.env.PASSWORD || '',
          database: process.env.DATABASE,
          port: 3306,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 10000,
        });
      }
      if (pool) {
        console.log(`${process.env.NODE_ENV} connection pool created`);
      }
    } catch (error) {
      console.error('Error creating connection pool:', error);
    }
  }
}

function getPool(): Pool {
  if (!pool) {
    throw new Error(
      'Database connection pool not initialized. Call connectUserDB first.'
    );
  }
  return pool;
}

export { connectUserDB, getPool };
