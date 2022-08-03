const Sequelize = require('sequelize');
const Model = Sequelize.Model;
const db = require('./db');

class Bank extends Model {
}
Bank.init({
    bankId: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
    },
    bankName: {
        type: Sequelize.STRING,
        allowNull: false
    }
}, {
    sequelize: db,
    modelName: 'bank'
});

module.exports = Bank;