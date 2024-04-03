require('dotenv').config();

const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");

const { Client } = require("langsmith");

exports.embeddingsModel = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY, 
    batchSize: 512,
    modelName: "text-embedding-3-large",
    dimensions: 512
  });

exports.chatOpenAImodel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.5,
  verbose: true
});

exports.langSmithClient = new Client();