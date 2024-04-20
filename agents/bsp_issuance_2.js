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
const { getLatestBSPIssuance } = require('./tools/getLatestBSPIssuance')

const BSPRegulations = require('../models/bsp_issuance');

const now = new Date().toISOString().split('T')[0];

process.env['OPENAI_API_KEY'] = process.env.OPENAI_API_KEY

process.env['LANGCHAIN_TRACING_V2'] = process.env.LANGCHAIN_TRACING_V2
process.env['LANGCHAIN_ENDPOINT'] = process.env.LANGCHAIN_ENDPOINT
process.env['LANGCHAIN_API_KEY'] = process.env.LANGCHAIN_API_KEY
process.env['LANGCHAIN_PROJECT'] = process.env.LANGCHAIN_PROJECT

exports.bsp_agent_2 = async() => {
	try {
		url = "https://www.bsp.gov.ph/SitePages/Regulations/RegulationsList.aspx?TabId=1"
		const web_bsp_issuances = await load_webpage(url)
    if(web_bsp_issuances.code === 1) {
      console.log(web_bsp_issuances.msg)
      return web_bsp_issuances
    }
		// const splitted_docs = await split_docs(rawDocs)
		// const vectorstore = await MemoryVectorStore.fromDocuments(
		// 	splitted_docs,
		// 	embeddingsModel
		// );
		// const retriever = vectorstore.asRetriever(20);

		const MEMORY_KEY = "chat_history";
		const chatHistory = [];
				
		// const bspIssuanceRetrieverTool = createRetrieverTool(retriever, {
		// 	name: "bsp_issuance_search",
		// 	description:
		// 		"If you want to get values of bsp issuances, use this tool",
		// });

		const tools = [
      await getLatestBSPIssuance(),
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

		const input1 = `I have scraped a list of objects ${JSON.stringify(web_bsp_issuances, null, 2)}. Lets call this list A. 
      Can you compare list A to the existing bsp issuances that we have. I want to get the list of latest bsp issuance.`
		const result1 = await executorWithMemory.invoke({
			input: input1,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input1));
		chatHistory.push(new AIMessage(result1.output));


    // const input2 = `Can you compare list A to the existing bsp issuances that we have. I want to get the list of latest bsp issuance.`
		// const result2 = await executorWithMemory.invoke({
		// 	input: input2,
		// 	chat_history: chatHistory
		// });
		// chatHistory.push(new HumanMessage(input2));
		// chatHistory.push(new AIMessage(result2.output));

    const input3 = `Can you show list B.`
		const result3 = await executorWithMemory.invoke({
			input: input3,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input3));
		chatHistory.push(new AIMessage(result3.output));

		const input4 = `
      Can you do the following:
			1. Can you send it on an email to yul.stewart.gurrea@ph.ey.com.
			2. The subject would be Latest BSP Issuance.
			3. For the body of the email, can you create a simple html. Can you start it with a Greetings from Intelligo then followed by Here is a list of new BSP Issuance. 
      Followed by List B. List B should strictltrictly in table format.
      example of the table format is
      <style>
        table, th, td {
          border:1px solid black;
        }
      </style>
      <table style='width:100%;'>
        <tr>
          <th>Number</th>
          <th>Date Issued</th>
          <th>Subject</th>
          <th>Link</th>
        </tr>
        <tr>
          <td>number</td>
          <td>date issued</td>
          <td>subject</td>
          <td>link</td>
        </tr>
      </table>
			Alignment should be left. 
			On the bottom of this, please include where you got the information from. Use this ${url}. 
			Then end the email with a thank you. Only send the email if the latest issued date on the bsp list is equal to today.
		`
		const result4 = await executorWithMemory.invoke({
			input: input4,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input4));
		chatHistory.push(new AIMessage(result4.output));

		const input5 = `Can you save list B in the database.`
		const result5 = await executorWithMemory.invoke({
			input: input5,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input5));
		chatHistory.push(new AIMessage(result5.output));
    console.log(chatHistory)
		return {
			code: 0,
			data: chatHistory
		}
	} catch(e) {
		return {
			code: 1,
			msg: e
		}
	}
}

const load_webpage = async(url) => {
	try {
    console.log('Loading web page.')
		const browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
			'ignoreHTTPSErrors': true
		});
		const page = await browser.newPage();
		const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })

    if (response.status() !== 200) {
      return {
        code: 1,
        msg: `Unable to reach website. Status: ${response.status()}`
      }
    }

		await page.waitForSelector('#RegTable', { visible: true, timeout: 60000 });

    // Extract data from the table
    const tableData = await page.evaluate(() => {
      const table = document.querySelector('#RegTable');
      const rows = table.querySelectorAll('tbody  tr');
      return Array.from(rows, row => {
        const cells = row.querySelectorAll('td');
        return {
            number: cells[0].innerText.trim(),
            dateIssued: cells[1].innerText.trim(),
            subject: cells[2].innerText.trim(),
            link: cells[0].querySelector('a').href
        };
      });
    });
		
		await browser.close()
		// const docHTMLContent = new Document({ pageContent: `${JSON.stringify(tableData, null, 2)}`, metadata: {source: url} });
		return {
      code: 0,
      msg: 'Success',
      data: tableData
    }
	} catch(e) {
		return {
      code: 1,
      msg: `Error ${e}`
    }
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
