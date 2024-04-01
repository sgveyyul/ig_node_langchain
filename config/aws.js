// https://awstip.com/upload-file-in-chunks-to-aws-s3-using-nodejs-1d0022681e1c
require('dotenv').config()
const { S3Client } = require("@aws-sdk/client-s3")

const s3 = new S3Client({
 region: process.env.S3_REGION,
 credentials: {
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
 },
})

module.exports.s3 = s3;