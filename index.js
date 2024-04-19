require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
var cors = require('cors')
const { run_cron } = require('./cron')

const uploadRoutes = require('./routes/upload.js')
const gptRoutes = require('./routes/gpt.js')

const app = express()

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
process.env['LANGCHAIN_TRACING_V2'] = process.env.LANGCHAIN_TRACING_V2;
process.env['LANGCHAIN_ENDPOINT'] = process.env.LANGCHAIN_ENDPOINT;
process.env['LANGCHAIN_API_KEY'] = process.env.LANGCHAIN_API_KEY;
process.env['LANGCHAIN_PROJECT'] = process.env.LANGCHAIN_PROJECT;

app.use(cors({
    origin: '*'
}))
app.use(bodyParser.json({ limit: '2gb' }));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

const port = process.env.PORT || 8000;

app.use('/api/v1', uploadRoutes);
app.use('/api/v1', gptRoutes);

run_cron()

// run application
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
});