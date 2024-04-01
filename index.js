require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
var cors = require('cors')

const uploadRoutes = require('./routes/upload.js')

const app = express()

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

app.use(cors({
    origin: '*'
}))
app.use(bodyParser.json({ limit: '2gb' }));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

const port = process.env.PORT || 8000;

app.use('/api/v1', uploadRoutes);

// run application
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
});