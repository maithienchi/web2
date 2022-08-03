const Sequelize = require('sequelize');
const Model = Sequelize.Model;
const db = require('./db');

class InterestRate extends Model {
}
InterestRate.init({
    id: {
        type: Sequelize.INTEGER,
        unique: true,
        allowNull: false,
        autoIncrement: true
    },
    type_deposit: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
    },
    year: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
    },
    period: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        defaultValue: 0
    },
    annual_interest_rate: {
        type: Sequelize.DECIMAL,
        allowNull: false,
        defaultValue: 0
    },
}, {
    sequelize: db,
    modelName: 'interestRate'
});

module.exports = InterestRate;