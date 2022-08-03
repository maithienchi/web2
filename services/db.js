const Sequelize = require('sequelize');

connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/salabank';
const db = new Sequelize(connectionString);

module.exports = db;