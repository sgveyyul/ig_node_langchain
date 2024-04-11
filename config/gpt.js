require('dotenv').config();

const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");

const { Client } = require("langsmith");

const OpenAI = require("openai");

process.env['LANGCHAIN_TRACING_V2'] = process.env.LANGCHAIN_TRACING_V2;
process.env['LANGCHAIN_ENDPOINT'] = process.env.LANGCHAIN_ENDPOINT;
process.env['LANGCHAIN_API_KEY'] = process.env.LANGCHAIN_API_KEY;
process.env['LANGCHAIN_PROJECT'] = process.env.LANGCHAIN_PROJECT;

exports.embeddingsModel = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY, 
    batchSize: 512,
    modelName: "text-embedding-3-large",
    dimensions: 512
  });

exports.chatOpenAImodel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.8,
  verbose: true
});

exports.intelligo_openai = new OpenAI()