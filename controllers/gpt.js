require('dotenv').config();
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");

const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { createHistoryAwareRetriever } = require("langchain/chains/history_aware_retriever");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");
const { PGVectorStore } = require("@langchain/community/vectorstores/pgvector");

const { 
  chatOpenAImodel,
  embeddingsModel,
  intelligo_openai 
} = require('../config/gpt')

const { pgVectorConfig } = require("../config/pgdb")

const { ChatMessageHistory } = require("langchain/stores/message/in_memory");

const { BaseMessage } = require("@langchain/core/messages");
const {
  RunnablePassthrough,
  RunnableSequence,
  RunnableBranch
} = require("@langchain/core/runnables");

const { StringOutputParser } = require("@langchain/core/output_parsers");

const { v4: uuidv4 } = require("uuid");

const { fs } = require("fs");

const { ElevenLabsClient, play } = require("elevenlabs");

const { Readable } = require("stream");
const { toFile } = require("openai/uploads");

exports.gpt = async (req, res) => {
  let file = req.file
  let chatMessages = req.body.chatMessages;
  if(typeof chatMessages === 'string') {
    chatMessages = JSON.parse(chatMessages);
  }
  

  const lastMessageIndex = chatMessages.length - 1;
  const lastMessage = chatMessages[lastMessageIndex];
  const question = lastMessage ? lastMessage.message : null;
  console.log('question', question)

  let audioFile = undefined
  let elevenLabs = undefined
  if(file) {
    elevenLabs = new ElevenLabsClient({
      apiKey: "YOUR_API_KEY" // Defaults to process.env.ELEVENLABS_API_KEY
    })
    audioFile = convertAudioToText(file)
    console.log('convertAudioToText', audioFile)
    chatMessages.push({message: audioFile, sender: 'user', direction: 'outgoing'})
  }
  console.log('chatMessages', chatMessages)
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
        content: file ? await convertTextToAudio(handleDocumentChainRes.answer) : handleDocumentChainRes.answer,
        role: 'assistant'
      },
    });
  }

  // If bot cannot retrieve asnwers from vector database
  const result = await handlePrompTemplatesChain(chatHistory)

  return res.status(200).json({
    success: true,
    // message: {
    //   content: result.content,
    //   role: 'assistant'
    // },
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

const handleDocumentChain = async(retriever, conversation, docs, file) => {
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

const convertAudioToText = async(file) => {
  print('file', file)
  const bufferStream = await toFile(Readable.from(file.buffer), file.originalname);

  console.log(bufferStream)

  const transcription = await intelligo_openai.audio.transcriptions.create({
    file: bufferStream,
    model: "whisper-1",
  });
  
  console.log('convertAudioToText', transcription)
  return transcription.text
}

const convertTextToAudio = async(text) => {
  const audio = await elevenlabs.generate({
    voice: "Rachel",
    text: text,
    model_id: "eleven_multilingual_v2"
  });

  return audio
}