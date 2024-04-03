require('dotenv').config();
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");

const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { createHistoryAwareRetriever } = require("langchain/chains/history_aware_retriever");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");
const { PGVectorStore } = require("@langchain/community/vectorstores/pgvector");

const { chatOpenAImodel, embeddingsModel } = require('../config/gpt')

const { pgVectorConfig } = require("../config/pgdb")

const { ChatMessageHistory } = require("langchain/stores/message/in_memory");

const { BaseMessage } = require("@langchain/core/messages");
const {
  RunnablePassthrough,
  RunnableSequence,
  RunnableBranch
} = require("@langchain/core/runnables");

const { StringOutputParser } = require("@langchain/core/output_parsers");

exports.gpt = async (req, res) => {
  let chatMessages = req.body.chatMessages;
  console.log(chatMessages)

  const lastMessageIndex = chatMessages.length - 1;
  const lastMessage = chatMessages[lastMessageIndex];
  const question = lastMessage ? lastMessage.message : null;
  console.log('question', question)

  const chatHistory = formatChatHistory(chatMessages)
  console.log('conversation', chatHistory)
  
  const pgvectorStore = new PGVectorStore(embeddingsModel, pgVectorConfig);
  let retriever = pgvectorStore.asRetriever(4)

  let pgVectorResult = await pgvectorStore.similaritySearch(question, 5)
  console.log('pgVectorResult', pgVectorResult)

  if(pgVectorResult && pgVectorResult.length > 0) {
    const handleDocumentChainRes = await handleDocumentChain(retriever, chatHistory, pgVectorResult)
    console.log('handleDocumentChainRes', handleDocumentChainRes)
    return res.status(200).json({
      success: true,
      message: {
        content: handleDocumentChainRes.answer,
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

const handleDocumentChain = async(retriever, conversation, docs) => {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "Answer the user's questions based on the below context:\n\n{context}",
    ],
    new MessagesPlaceholder("messages"),
  ]);
  const documentChain = await createStuffDocumentsChain({
    llm: chatOpenAImodel,
    prompt: prompt,
  });

  await documentChain.invoke({
    messages: conversation,
    context: docs,
  });

  const parseRetrieverInput = (params) => {
    return params.messages[params.messages.length - 1].content;
  };

  const retrievalChain = RunnablePassthrough.assign({
    context: RunnableSequence.from([parseRetrieverInput, retriever]),
  }).assign({
    answer: documentChain,
  });

  await retrievalChain.invoke({messages: conversation})
  
  const queryTransformPrompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("messages"),
    [
      "user",
      "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation. Only respond with the query, nothing else.",
    ],
  ]);

  const queryTransformingRetrieverChain = RunnableBranch.from([
    [
      (params) => params.messages.length > 0,
      RunnableSequence.from([parseRetrieverInput, retriever]),
    ],
    queryTransformPrompt
      .pipe(chatOpenAImodel)
      .pipe(new StringOutputParser())
      .pipe(retriever),
  ]).withConfig({ runName: "chat_retriever_chain" });

  const conversationalRetrievalChain = RunnablePassthrough.assign({
    context: queryTransformingRetrieverChain,
  }).assign({
    answer: documentChain,
  });

  const result = await conversationalRetrievalChain.invoke({messages: conversation})
  return result
}