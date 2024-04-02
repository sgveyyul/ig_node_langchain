require('dotenv').config();
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

const { chatOpenAImodel } = require('../config/gpt')

const { pgVectorConfig } = require("../config/pgdb")


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
  console.log('question', question)

  const similarityThreshold = 0.75;
  const chatHistory = formatChatHistory(chatMessages)
  console.log('conversation', chatHistory)

  const embeddingsModel = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY, 
    batchSize: 512,
    modelName: "text-embedding-3-large",
    dimensions: 512
  });
  
  const pgvectorStore = new PGVectorStore(embeddingsModel, pgVectorConfig);

  const similarityScoreFilter = {
    type: "similarityScore", // This is hypothetical and needs to be adjusted
    condition: ">=",
    value: similarityThreshold
  };

  const pgVectorResult = await pgvectorStore.similaritySearch(question, 5, similarityScoreFilter)
  console.log('pgVectorResult', pgVectorResult)

  if(pgVectorResult && pgVectorResult.length > 0) {
    return res.status(200).json({
      success: true,
      message: {
        content: pgVectorResult[0].pageContent,
        role: 'assistant'
      },
    });
  }

  // const chain = new LLMChain({ llm: chatOpenAImodel, prompt: template });
  // const result = await chain.call({ question: question });

  const result = prompTemplates(chatHistory)

  return res.status(200).json({
    success: true,
    message: {
      content: result.content,
      role: 'assistant'
    },
  });
}

const prompTemplates = async(conversation) => {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are a helpful assistant. Answer all questions to the best of your ability.",
    ],
    new MessagesPlaceholder("messages"),
  ]);
  const chain = prompt.pipe(chatOpenAImodel);
  const result = await chain.invoke({messages: conversation})
  console.log('result', result)
  return result
}
