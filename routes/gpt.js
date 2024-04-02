// import express
const express = require('express');
const multer = require("multer")

//initialize express router
const router = express.Router();

// import user controllers
const gptController  = require('../controllers/gpt');

// const userAuthController = require('../controllers/user_auth');

// initial api
router.post(
  '/gpt',
//   userAuthController.authenticateJWT, 
gptController.gpt
);

//export module
module.exports = router;