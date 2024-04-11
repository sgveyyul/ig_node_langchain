const { CheerioWebBaseLoader } = require("langchain/document_loaders/web/cheerio");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { HtmlToTextTransformer } = require("@langchain/community/document_transformers/html_to_text");
const { AgentExecutor, createOpenAIToolsAgent } = require("langchain/agents");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");

import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";

const OPENAI_API_KEY='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'

const bsp_agent = async() => {
  const docs = load_webpage("https://news.ycombinator.com/item?id=34817881")
  const splitted_docs = split_docs(docs)

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "Answer the user's questions based on the below context:\n\n{context}",
    ],
    new MessagesPlaceholder("messages"),
  ]);

  const vectorstore = await MemoryVectorStore.fromDocuments(
    splitted_docs,
    new OpenAIEmbeddings({
      openAIApiKey: OPENAI_API_KEY, 
      batchSize: 512,
      modelName: "text-embedding-3-large",
      dimensions: 512
    })
  );

  const retriever = vectorstore.asRetriever(4);
  const result = await retriever.invoke("Can you summarize the context?");
  console.log(result)
}

// const setupAgent = async() => {
//   const agent = await createOpenAIToolsAgent({
//     llm: model,
//     tools,
//     prompt,
//   });

//   const agentExecutor = new AgentExecutor({
//     agent,
//     tools,
//     verbose: true,
//   });

//   const result = await agentExecutor.invoke({
//     input:
//     "Take 3 to the fifth power and multiply that by the sum of twelve and three, then square the whole result",
//   });
//   return result 
// }

const load_webpage = async(url) => {
  const loader = new CheerioWebBaseLoader(url);
  const docs = await loader.load();
  return docs
}

const split_docs = async(docs) => {
  const splitter = RecursiveCharacterTextSplitter.fromLanguage("html");
  const transformer = new HtmlToTextTransformer();
  const sequence = splitter.pipe(transformer);
  const newDocuments = await sequence.invoke(docs);
  return newDocuments
}

bsp_agent()