require('dotenv').config();
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");

const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");

const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { ChatMessageHistory } = require("langchain/stores/message/in_memory");

const {
  RunnablePassthrough,
  RunnableSequence,
} = require("@langchain/core/runnables");

const { Document } = require("langchain/document");

const { createRetrieverTool } = require("langchain/tools/retriever");

const { AgentExecutor, createOpenAIFunctionsAgent } = require("langchain/agents");

const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

const puppeteer = require("puppeteer"); 

const fs = require('node:fs');

const nodemailer = require('nodemailer');

const { 
  chatOpenAImodel,
  embeddingsModel,
  intelligo_openai 
} = require('../config/gpt')

const now = new Date().toISOString().split('T')[0];
// const now = '2024-03-26'

exports.bsp_agent = async() => {
  try {
    url = "https://www.bsp.gov.ph/SitePages/Regulations/RegulationsList.aspx?TabId=1"
    const rawDocs = await load_webpage(url)

    const splitted_docs = await split_docs(rawDocs)
    console.log('splitted_docs', splitted_docs, 'splitted_docs')

    const vectorstore = await MemoryVectorStore.fromDocuments(
      splitted_docs,
      embeddingsModel
    );

    const retriever = vectorstore.asRetriever();

    const docs = await retriever.invoke("can you give me the list of bsp issuance? Include the number, date issued and subject. ");

    const demoEphemeralChatMessageHistory2 = new ChatMessageHistory();
    
    const bspIssuanceRetrieverTool = createRetrieverTool(retriever, {
      name: "bsp_issuance_search",
      description:
        "If you want to search for the list of bsp issuance, use this tool",
    });

    const tools = [
      bspIssuanceRetrieverTool,
      new DynamicStructuredTool({
        name: "send-email",
        description: "if you want to send an email to a user, user this tool.",
        schema: z.object({
          to: z.string().describe("the email we will send to"),
          subject: z.string().describe("the subject of the email"),
          body: z.string().describe("the message of the email"),
          date: z.string().describe(`the latest issued date on the bsp list`)
        }),
        func: async ({ to, subject, body, date }) =>{
          console.log({ to, subject, body, date })
          if(date === now) {
            await bsp_issuance_email_tool(to, subject, body)
          }
        }
           // Outputs still must be strings
      }),
    ];

    const prompt = ChatPromptTemplate.fromMessages([
      ('system', 'You are a helpful assistant.'),
      ('human', "{input}"),
      new MessagesPlaceholder('agent_scratchpad')
    ])

    console.log('prompt', prompt)

    const agent = await createOpenAIFunctionsAgent({
      llm: chatOpenAImodel,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });
    
    const result1 = await agentExecutor.invoke({
      input: "can you give me the list of bsp issuance? Include the number, data issued and subject.",
      // chat_history: await demoEphemeralChatMessageHistory2.getMessages()
    });

    await demoEphemeralChatMessageHistory2.addMessage(
      new HumanMessage('can you give me the list of bsp issuance? Include the number, data issued and subject.')
    );

    await demoEphemeralChatMessageHistory2.addMessage(
      new AIMessage(result1.output)
    );

    const result2 = await agentExecutor.invoke({
      input:  `
        Based on the data above, can you compose an email to yul.stewart.gurrea@ph.ey.com. Start the email with a polite greeting.
        For the body of the email, can you create a simple html for the list of latest bsp issuances. 
        Please include the number, date issued and subject. On the bottom of this, please include where you got the information from. Use this ${url}. 
        Then end the email with a thank you. Only send the email if the latest issued date on the bsp list is equal to today.
      `,
      chat_history: await demoEphemeralChatMessageHistory2.getMessages()
    });

    await demoEphemeralChatMessageHistory2.addMessage(
      new HumanMessage(
        `
          Based on the data above, can you compose an email to yul.stewart.gurrea@ph.ey.com. Start the email with a polite greeting.
          For the body of the email, can you create a simple html for the list of latest bsp issuances. 
          Please include the number, date issued and subject. On the bottom of this, please include where you got the information from. Use this ${url}. 
          Then end the email with a thank you. Only send the email if the latest issued date on the bsp list is equal to today.
        `
      )
    );

    await demoEphemeralChatMessageHistory2.addMessage(
      new AIMessage(result2.output)
    );

    // console.log(response2)
    console.log(result2)
  } catch(e) {
    console.log(e)
  }
  

}

const load_webpage = async(url) => {
  try{
    const browser = await puppeteer.launch({
      headless: false,
      args: ["--disable-setuid-sandbox"],
      'ignoreHTTPSErrors': false
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    
    await page.waitForSelector('#RegTable_wrapper', { timeout: 60000 });
    const bodyText = await page.evaluate(() => document.body.innerText);
	  await browser.close()
    const doc = new Document({ pageContent: bodyText, metadata: {source: url} });
    return doc
  } catch(e) {
    console.log(e)
  }
}

const split_docs = async(docs) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1500,
    chunkOverlap: 20
  });
  const docOutput  = await splitter.splitDocuments([docs]);
  return docOutput
}

const bsp_issuance_email_tool = async(to, subject, body) => {
  console.log('bsp_issuance_email_tool', to, subject, body, 'bsp_issuance_email_tool')
  try {
    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    
    let info = await transporter.sendMail({
      from: '"IntelliGo-noreply" <anderson.bondoc@ph.ey.com>',
      to: to,
      subject: subject,
      html: body,
    });

    console.log('sendMail details: ', subject, info);
    
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error; // You can rethrow the error to handle it in the calling code.
  }
}