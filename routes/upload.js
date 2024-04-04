// import express
const express = require('express');
const multer = require("multer")

//initialize express router
const router = express.Router();

// import user controllers
const uploadFileController  = require('../controllers/upload');

// const userAuthController = require('../controllers/user_auth');

// Set up Multer middleware to handle file uploads
// by default, multer will store files in memory
const upload = multer({
  storage: multer.memoryStorage()
})

// initial api
router.post(
  '/upload',
  upload.single("file"),
//   userAuthController.authenticateJWT, 
  uploadFileController.fileUpload
);

//export module
module.exports = router;