const { ChatOpenAI } = require("@langchain/openai");

const { Client } = require("langsmith");

exports.chatOpenAImodel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.5,
  verbose: true
});

exports.langSmithClient = new Client();