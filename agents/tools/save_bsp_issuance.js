require('dotenv').config();
const nodemailer = require('nodemailer');

const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

const BSPRegulations = require('../../models/bsp_issuance');

exports.saveBSPIssuance = async () => {
  const bspSchema = z.object({
      number: z.string().describe(`the number of the bsp issuance`),
      date_issued: z.string().describe(`the issued date of the bsp issuance`),
      subject: z.string().describe(`the subject of the bsp issuance`),
      url: z.string().describe(`the url link of the bsp list`)
  });

  const regex = /^\d{4}-\d{2}-\d{2}$/;

  return new DynamicStructuredTool({
    name: "save-bsp-issuance",
    description: "If you want to save the new bsp issuances in the database, use this tool.",
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
}