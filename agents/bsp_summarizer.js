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
const { readSignedDocument } = require('./tools/read_signed_document')

const now = new Date().toISOString().split('T')[0];

process.env['OPENAI_API_KEY'] = process.env.OPENAI_API_KEY

process.env['LANGCHAIN_TRACING_V2'] = process.env.LANGCHAIN_TRACING_V2
process.env['LANGCHAIN_ENDPOINT'] = process.env.LANGCHAIN_ENDPOINT
process.env['LANGCHAIN_API_KEY'] = process.env.LANGCHAIN_API_KEY
process.env['LANGCHAIN_PROJECT'] = process.env.LANGCHAIN_PROJECT

exports.bsSummarizerAgent = async() => {
	try {
		url = "https://www.bsp.gov.ph/SitePages/Regulations/RegulationDisp.aspx?ItemId=4991"
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

		input1 = "Can you get the link of the signed document."
		const result1 = await executorWithMemory.invoke({
			input: input1,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input1));
		chatHistory.push(new AIMessage(result1.output));
		
		input2 = `
			Can you summarize the signed document.
		`
		const result2 = await executorWithMemory.invoke({
			input: input2,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input2));
		chatHistory.push(new AIMessage(result2.output));

		// input3 = `
		// 	Can you convert the bsp issuances in to a list and save it on the database. The keys of the object are
		// 	number, date_issued, subject and url.
		// `
		// const result3 = await executorWithMemory.invoke({
		// 	input: input3,
		// 	chat_history: chatHistory
		// });
		// chatHistory.push(new HumanMessage(input3));
		// chatHistory.push(new AIMessage(result3.output));

		console.log('chatHistory', chatHistory)
	} catch(e) {
		console.log(e)
	}
}

const load_webpage = async(url) => {
	try{
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
	const splitter = new RecursiveCharacterTextSplitter({
		chunkSize: 1500,
		chunkOverlap: 20
	});
	const docOutput  = await splitter.splitDocuments(docs);
	return docOutput
}
