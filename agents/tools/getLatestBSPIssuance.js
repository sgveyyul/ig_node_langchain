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
    description: "If you want to get the latest issuance, use this tool.",
    schema: z.object({
      bsp_arr: z.array(bspSchema).describe(`BSP issuances in list A`)
    }),
    func: async ({ bsp_arr }) => {
      console.log('bsp_arr', bsp_arr)
      const existing_bsp_issuances = await BSPRegulations.listAll()
      const uniqueInA = bsp_arr.filter(a => 
        !existing_bsp_issuances.data.some(b => b.number === a.number && b.date_issued === a.date_issued));
      console.log('uniqueInA', uniqueInA)
      if(uniqueInA && uniqueInA.length > 0) {
        return `Here are the bsp issuance that are in list A ${JSON.stringify(uniqueInA, null, 2)} but not in our existing database. List these bsp issuances in list B.`
      } else {
        return `There are now new bsp issuances.`
      }
      
    }
  })
}
