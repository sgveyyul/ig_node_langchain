const { Sequelize, DataTypes } = require("sequelize")
const { sequelize } = require('../config/db.config.js')

const moment = require('moment')

const BSPIssuance = sequelize.define(
  'bsp_issuance', 
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    date_issued: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  { freezeTableName: true },
  { timestamps: false }
)

create = async (number, category, date_issued, subject, url) => {
  console.log(number, category, date_issued, subject)
  return await BSPIssuance.create({
    number: number,
    category: category,
    date_issued: date_issued,
    subject: subject,
    url: url
  })
  .then(async (result) => {
    return {
      code: 0,
      success: true,
      msg: `Success.`,
      data: result?.dataValues
    }
  })
  .catch(async (err) => {
    return {
      code: 1,
      success: false,
      msg: `Unsuccessful. ${err}`
    }
  });
}

listAll = async () => {
  return await BSPIssuance.findAll({
    order: [['date_issued', 'DESC']],
		limit: 10
  })
    .then(async (result) => {
      return {
        code: 0,
        success: true,
        msg: `Success.`,
        data: await result?.dataValues
      }
    })
    .catch(async (err) => {
      return {
        code: 1,
        success: false,
        msg: `Unsuccessful. ${err}`
      }
    });
}

module.exports = {
	BSPIssuance,
  create,
  listAll
}