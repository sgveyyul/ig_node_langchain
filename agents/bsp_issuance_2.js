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

const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

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

    const bspSchema = z.object({
      number: z.string().describe(`the number of the bsp issuance`),
      date_issued: z.string().describe(`the issued date of the bsp issuance`),
      subject: z.string().describe(`the subject of the bsp issuance`),
      url: z.string().describe(`the url link of the bsp list`)
    });

    const regex = /^\d{4}-\d{2}-\d{2}$/;

		const tools = [
      // await getLatestBSPIssuance(),
      new DynamicStructuredTool({
        name: "get-latest-bsp-issuance",
        description: "compare scraped list with database and check if there are new bsp issuances.",
        schema: z.object({
          bsp_arr: z.array(bspSchema).describe(`BSP issuances in scraped list`)
        }),
        func: async ({ bsp_arr }) => {
          console.log('bsp_arr', bsp_arr)
          const existing_bsp_issuances = await BSPRegulations.listAll()
          console.log('existing_bsp_issuances', existing_bsp_issuances.data)
          const uniqueInA = bsp_arr.filter(a => 
            !existing_bsp_issuances.data.some(b => b.number === a.number && b.date_issued === a.date_issued));
          console.log('uniqueInA', uniqueInA)
          if(uniqueInA && uniqueInA.length > 0) {
            return `Here are the list of new bsp issuances ${JSON.stringify(uniqueInA, null, 2)}.`
          } else {
            return `There are no new bsp issuances.`
          }
        }
      }),
			new DynamicStructuredTool({
        name: "send-email",
        description: "if you want to send an email to a user, user this tool.",
        schema: z.object({
          to: z.string().array().describe("array of user emails we will send out to"),
          subject: z.string().describe("the subject of the email"),
          body: z.string().describe("the message of the email"),
          bsp_arr: z.array(bspSchema).describe(`list of all new bsp issuances in conversation.`)
        }),
        func: async ({ to, subject, body, bsp_arr }) => {
          // validate data
          console.log('sendEmailTool', bsp_arr)
          if(bsp_arr && bsp_arr.length > 0) {
            for(var i in bsp_arr) {
              if(bsp_arr[i].number && bsp_arr[i].number.length < 4) {
                return `I encountered an error when validating the data. No email was sent.`
              }
              if(bsp_arr[i].date_issued && !regex.test(bsp_arr[i].date_issued )) {
                return `I encountered an error when validating the data. No email was sent.`
              }
            }
            
            for(var i in to) {
              await send_email(to[i], subject, body)
            }
            return `The email was sent successfully.`
          } else {
            return `No email was sent since there are no new bsp issuances.`
          }
        }
      }),
			new DynamicStructuredTool({
        name: "save-bsp-issuance",
        description: "If you want to save new bsp issuances in the database, use this tool.",
        schema: z.object({
          bsp_arr: z.array(bspSchema).describe(`list of all new bsp issuances in conversation.`),
        }),
        func: async ({ bsp_arr }) => {
          console.log('saveBSPIssuance', bsp_arr)
          if(bsp_arr && bsp_arr.length === 0) {
            return `There are no new bsp issuances to save in the database.`
          }
          for(var i in bsp_arr) {
            if(bsp_arr[i].number && bsp_arr[i].number.length < 4) {
              console.log('number issue')
              continue
            }
            if(bsp_arr[i].date_issued && !regex.test(bsp_arr[i].date_issued )) {
              console.log('date issue')
              continue
            }
            try {
              await BSPRegulations.create(bsp_arr[i].number, 'BSP_ISSUANCE', bsp_arr[i].date_issued, bsp_arr[i].subject, bsp_arr[i].url)
            } catch(e) {
              console.log(e)
              continue
            }
          }
          return `All new bsp issuances with correct values are saved to the database.`
        }
      })
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

		const input1 = `Can you check if there are new bsp issuances in this scraped list ${JSON.stringify(web_bsp_issuances.data, null, 2)}.`
		const result1 = await executorWithMemory.invoke({
			input: input1,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input1));
		chatHistory.push(new AIMessage(result1.output));

		const input2 = `
      Can you do the following:
			1. Can you send it on an email to yul.stewart.gurrea@ph.ey.com.
			2. The subject would be Latest BSP Issuance.
			3. For the body of the email, can you create a simple html. Can you start it with a Greetings from Intelligo then followed by Here is a list of new BSP Issuance. 
      Followed by the list of new bsp issuances. New bsp issuances should strictly in table format.
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
		const result2 = await executorWithMemory.invoke({
			input: input2,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input2));
		chatHistory.push(new AIMessage(result2.output));

		const input3 = `Can you save the list of new bsp issuances in the database.`
		const result3 = await executorWithMemory.invoke({
			input: input3,
			chat_history: chatHistory
		});
		chatHistory.push(new HumanMessage(input3));
		chatHistory.push(new AIMessage(result3.output));
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
