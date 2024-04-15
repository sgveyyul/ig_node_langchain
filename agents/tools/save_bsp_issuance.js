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

  return new DynamicStructuredTool({
    name: "save-bsp-issuance",
    description: "Tool for saving bsp issuances in the database. The keyword here is save in the database.",
    schema: z.object({
      bsp_arr: z.array(bspSchema).describe(`object list of all bsp issuances. composed of number, date issued, subject and url.`),
    }),
    func: async ({ bsp_arr }) => {
        const existing_bsp = await BSPRegulations.listAll()
        for(var i in existing_bsp.data) {
          if(bsp_arr.length === 0) {
            for(var j in bsp_arr) {
              if(bsp_arr[j].number.length < 4) {
                return 'Invalid format of bsp issuance number.'
              }
              if(bsp_arr[j].number !== existing_bsp.data[i].number && bsp_arr[j].date_issued !== existing_bsp.data[i].date_issued) {
                  // console.log(bsp_arr[j].number, 'BSP_ISSUANCE', bsp_arr[j].date_issued, bsp_arr[j].subject, bsp_arr[j].url)
                  await BSPRegulations.create(bsp_arr[j].number, 'BSP_ISSUANCE', bsp_arr[j].date_issued, bsp_arr[j].subject, bsp_arr[j].url)
              }
            }
            return `BSP Issuances with numbers ${bsp_arr.map(v => `"${v.number}"`).join(', ')} is saved to database.`
          } else {
            return 'No new bsp issuance to save.'
          }
            
        }
    }
  })
}