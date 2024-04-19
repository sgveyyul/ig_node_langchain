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
    description: "Tool for saving bsp issuances in the database. The keyword here is save in the database.",
    schema: z.object({
      bsp_arr: z.array(bspSchema).describe(`list of objects in list B`),
    }),
    func: async ({ bsp_arr }) => {
        console.log('bsp_arr', bsp_arr)
        if(bsp_arr && bsp_arr.length === 0) {
          return `There are no new bsp issuances to save in the database.`
        }

        for(var i in bsp_arr) {
          if(bsp_arr[i].number && bsp_arr[i].number.length < 4) {
            continue
          }
          if(bsp_arr[i].date_issued && !regex.test(bsp_arr[i].date_issued )) {
            continue
          }
          try {
            await BSPRegulations.create(bsp_arr[i].number, 'BSP_ISSUANCE', bsp_arr[i].date_issued, bsp_arr[i].subject, bsp_arr[i].url)
          } catch(e) {
            continue
          }
          return `All new bsp issuances with correct values are saved to the database.`
        }
    }
  })
}