const { ChatOpenAI } = require("@langchain/openai");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { pull } = require("langchain/hub");

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const { createOpenAIFunctionsAgent } = require("langchain/agents");

const { AgentExecutor } = require("langchain/agents");

exports.calculator_agent = async(converation) => {
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });
  
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });
  
  const result1 = await agentExecutor.invoke({
    input: "hi!",
  });
  
  console.log(result1)
  
  const result2 = await agentExecutor.invoke({
    input: "how can langsmith help with testing?",
  });
  
  console.log(result2);
}

exports.calculator_agent = calculator_agent
