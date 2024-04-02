require('dotenv').config();
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");

const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { createHistoryAwareRetriever } = require("langchain/chains/history_aware_retriever");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");
const { PGVectorStore } = require("@langchain/community/vectorstores/pgvector");

const { PromptTemplate } = require("@langchain/core/prompts");
const { LLMChain } = require("langchain/chains");

const { pgVectorConfig } = require("../config/pgdb")

const model = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.5,
  verbose: true
});

const formatChatHistory = (chatHistory) => {
  const conversation = [];
  chatHistory.forEach(dialogueTurn => {
    if (dialogueTurn.sender === 'gpt' || dialogueTurn.sender === 'SycipGPT') {
      conversation.push(new AIMessage(dialogueTurn.message));
    } else {
      conversation.push(new HumanMessage(dialogueTurn.message));
    }
  });
  return conversation;
};

exports.gpt = async (req, res) => {
  let chatMessages = req.body.chatMessages;
  const lastMessageIndex = chatMessages.length - 1;
  const lastMessage = chatMessages[lastMessageIndex];
  const question = lastMessage ? lastMessage.message : null;

  const embeddingsModel = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY, 
    batchSize: 512,
    modelName: "text-embedding-3-large",
    dimensions: 512
  });
  
  const template = "You are a professional accountant. Answer the query in a professional way. {question}"
  const pgvectorStore = new PGVectorStore(embeddingsModel, pgVectorConfig);

  const pgVectorResult = await pgvectorStore.similaritySearch(question, 1)
  console.log('pgVectorResult', pgVectorResult)

  if(pgVectorResult) {
    return res.status(200).json({
      success: true,
      message: {
        content: pgVectorResult[0],
        role: 'assistant'
      },
    });
  }

  const prompt = new PromptTemplate({ template, inputVariables: ["question"] });

  const chain = new LLMChain({ llm: embeddingsModel, prompt });

  const result = await chain.call({ question: question });

  return res.status(200).json({
    success: true,
    message: {
      content: result.answer,
      role: 'assistant'
    },
  });
}
