require('dotenv').config();
const nodemailer = require('nodemailer');

const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

const BSPRegulations = require('../../models/bsp_issuance');

const _ = require('lodash');

const bspSchema = z.object({
  number: z.string().describe(`the number of the bsp issuance`),
  date_issued: z.string().describe(`the issued date of the bsp issuance`),
  subject: z.string().describe(`the subject of the bsp issuance`),
  url: z.string().describe(`the url link of the bsp list`)
});

exports.getLatestBSPIssuance = async () => {
  return new DynamicStructuredTool({
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
        return `Here are the new bsp issuances ${JSON.stringify(uniqueInA, null, 2)}.`
      } else {
        return `There are no new bsp issuances.`
      }
      
    }
  })
}
