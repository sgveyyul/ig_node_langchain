require('dotenv').config();
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");

const { HumanMessage, AIMessage } = require("@langchain/core/messages");

const {
  RunnableSequence
} = require("@langchain/core/runnables");

const { Document } = require("langchain/document");

const { createRetrieverTool } = require("langchain/tools/retriever");

const { AgentExecutor } = require("langchain/agents");

const puppeteer = require("puppeteer"); 

const { 
	chatOpenAImodel,
	embeddingsModel
} = require('../config/gpt')

const { convertToOpenAIFunction } = require("@langchain/core/utils/function_calling");
const { formatToOpenAIFunctionMessages } = require("langchain/agents/format_scratchpad");
const { OpenAIFunctionsAgentOutputParser } = require("langchain/agents/openai/output_parser");

const { sendEmailTool } = require('./tools/send_email')
const { saveBSPIssuance } = require('./tools/save_bsp_issuance')

const BSPRegulations = require('../models/bsp_issuance');

const now = new Date().toISOString().split('T')[0];

process.env['OPENAI_API_KEY'] = process.env.OPENAI_API_KEY

process.env['LANGCHAIN_TRACING_V2'] = process.env.LANGCHAIN_TRACING_V2
process.env['LANGCHAIN_ENDPOINT'] = process.env.LANGCHAIN_ENDPOINT
process.env['LANGCHAIN_API_KEY'] = process.env.LANGCHAIN_API_KEY
process.env['LANGCHAIN_PROJECT'] = process.env.LANGCHAIN_PROJECT

exports.bsp_agent_2 = async() => {
	try {
    const existing_bsp = await BSPRegulations.listAll()
		url = "https://www.bsp.gov.ph/SitePages/Regulations/RegulationsList.aspx?TabId=1"
		const rawDocs = await load_webpage(url)

		const splitted_docs = await split_docs(rawDocs)

		const vectorstore = await MemoryVectorStore.fromDocuments(
			splitted_docs,
			embeddingsModel
		);

		const retriever = vectorstore.asRetriever(20);

		const MEMORY_KEY = "chat_history";
		const chatHistory = [];
				
		const bspIssuanceRetrieverTool = createRetrieverTool(retriever, {
			name: "bsp_issuance_search",
			description:
				"If you have questions regarding bsp issuances, use this tool",
		});

		const tools = [
			bspIssuanceRetrieverTool,
			await sendEmailTool(),
			await saveBSPIssuance()
		];

		const modelWithFunctions = chatOpenAImodel.bind({
			functions: tools.map((tool) => convertToOpenAIFunction(tool)),
		});

		const prompt = ChatPromptTemplate.fromMessages([
			['system', 'You are a helpful assistant.'],
			new MessagesPlaceholder(MEMORY_KEY),
			['human', "{input}"],
			new MessagesPlaceholder('agent_scratchpad')
		])

		const agentWithMemory = RunnableSequence.from([
			{
					input: (i) => i.input,
					agent_scratchpad: (i) => formatToOpenAIFunctionMessages(i.steps),
					chat_history: (i) => i.chat_history,
			},
			prompt,
			modelWithFunctions,
			new OpenAIFunctionsAgentOutputParser(),
		]);

		const executorWithMemory = AgentExecutor.fromAgentAndTools({
			agent: agentWithMemory,
			tools,
		});

		const input1 = `Can you list down all bsp issuances? I want the number, date issued and subject and their urls. Please format the output with labels for each field.
      For example:
      1. Number: CL-2024-018
      Date Issued: 2024-04-12
      Subject: Publication/Posting of Balance Sheet (BS)
      url: Link to Details
      2. Number: CL-2024-019
      Date Issued: 2024-04-12
      Subject: Publication/Posting of Statement of Condition and/or Consolidated Statement of Condition
      url: Link to Details`
		const result1 = await executorWithMemory.invoke({
			input: input1,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input1));
		chatHistory.push(new AIMessage(result1.output));

    const input2 = `Lets name the list above list A and this list of objects as list B ${JSON.stringify(existing_bsp.data, null, 2)}. 
    Can you compare list A and B using their keys number and date_issued, and get the elements that are in list A but not in list B.
    Create a list of objects for it and lets call it List C. The keys of the object are number, date_issued, subject and url.
    .`
		const result2 = await executorWithMemory.invoke({
			input: input2,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input2));
		chatHistory.push(new AIMessage(result2.output));
		
		const input3 = `
			Can you do the following:
			1. Can you send it on an email to yul.stewart.gurrea@ph.ey.com.
			2. The subject would be Latest BSP Issuance.
			3. For the body of the email, can you create a simple html for List C, strictly in table form with borders inside and out.
			Alignment should be left. 
			On the bottom of this, please include where you got the information from. Use this ${url}. 
			Then end the email with a thank you. Only send the email if the latest issued date on the bsp list is equal to today.
		`
		const result3 = await executorWithMemory.invoke({
			input: input3,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input3));
		chatHistory.push(new AIMessage(result3.output));

		const input4 = `
			Can you save list C on the database. The keys of the objects are
			number, date_issued, subject and url.
		`
		const result4 = await executorWithMemory.invoke({
			input: input4,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input4));
		chatHistory.push(new AIMessage(result4.output));
    console.log(chatHistory)
		return {
			code: 0,
			data: chatHistory
		}
	} catch(e) {
		return {
			code: 1,
			error: e
		}
	}
}

const load_webpage = async(url) => {
	try{
    console.log('Loading web page.')
		const browser = await puppeteer.launch({
			headless: "new",
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
			'ignoreHTTPSErrors': true
		});
		const page = await browser.newPage();
		await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
		
		await page.waitForSelector('#RegTable_wrapper', { timeout: 60000 });
		const htmlContent = await page.evaluate(() => document.body.outerHTML);
		const bodyText = await page.evaluate(() => document.body.innerText);
		await browser.close()
		const docHTMLContent = new Document({ pageContent: htmlContent, metadata: {source: url} });
		const docHTMLText = new Document({ pageContent: bodyText, metadata: {source: url} });
		return [docHTMLContent, docHTMLText]
		// return htmlContent
	} catch(e) {
		console.log(e)
	}
	
}

const split_docs = async(docs) => {
  console.log('Splitting documents.')
	const splitter = new RecursiveCharacterTextSplitter({
		chunkSize: 1500,
		chunkOverlap: 20
	});
	const docOutput  = await splitter.splitDocuments(docs);
	return docOutput
}
