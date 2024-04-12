require('dotenv').config()
const Sequelize = require("sequelize")

const sequelize = new Sequelize(
  process.env.DB_NAME, 
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    define: {
      timestamps: false
    }
  },
  
);

exports.sequelize = sequelize;

exports.connection = () => {
  sequelize.authenticate().then(() => {
    console.log('Connection has been established successfully.');
  }).catch((error) => {
    console.error('Unable to connect to the database: ', error);
  });
}