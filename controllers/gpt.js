require('dotenv').config();
const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { createHistoryAwareRetriever } = require("langchain/chains/history_aware_retriever");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");
const { PGVectorStore } = require("@langchain/community/vectorstores/pgvector");

const { chatOpenAImodel } = require('../config/gpt')

const { pgVectorConfig } = require("../config/pgdb")

exports.gpt = async (req, res) => {
  let chatMessages = req.body.chatMessages;

  const lastMessageIndex = chatMessages.length - 1;
  const lastMessage = chatMessages[lastMessageIndex];
  const question = lastMessage ? lastMessage.message : null;
  console.log('question', question)

  const similarityThreshold = 100;
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
    condition: "<",
    value: similarityThreshold
  };

  let pgVectorResult = await pgvectorStore.similaritySearch(question, 5)
  console.log('pgVectorResult', pgVectorResult)
  pgVectorResult.forEach((result, index) => {
    console.log(`Result ${index + 1} Similarity Score:`, result.similarityScore);
  });

  if(pgVectorResult && pgVectorResult.length > 0) {
    const handleDocumentChainRes = await handleDocumentChain(chatHistory, pgVectorResult)
    console.log('handleDocumentChainRes', handleDocumentChainRes)
    return res.status(200).json({
      success: true,
      message: {
        content: handleDocumentChainRes,
        role: 'assistant'
      },
    });
  }

  // If bot cannot retrieve asnwers from vector database
  const result = await handlePrompTemplatesChain(chatHistory)

  return res.status(200).json({
    success: true,
    message: {
      content: result.content,
      role: 'assistant'
    },
  });
}

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

const handlePrompTemplatesChain = async(conversation) => {
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

const handleDocumentChain = async(conversation, docs) => {
  const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "Answer the user's questions based on the below context:\n\n{context}",
    ],
    new MessagesPlaceholder("messages"),
  ]);
  
  const documentChain = await createStuffDocumentsChain({
    llm: chatOpenAImodel,
    prompt: questionAnsweringPrompt,
  });

  const result = await documentChain.invoke({messages: conversation, context: docs})
  return result
}