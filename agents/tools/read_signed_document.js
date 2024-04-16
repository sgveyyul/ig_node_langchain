require('dotenv').config();
const nodemailer = require('nodemailer');

const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

const BSPRegulations = require('../../models/bsp_issuance');

exports.readSignedDocument = async () => {
  return new DynamicStructuredTool({
    name: "read-bsp-issuance-signed-document",
    description: "Tool for saving bsp issuances in the database.",
    schema: z.object({
      number: z.string().describe(`the latest issued number on the bsp list`),
      subject: z.string().describe(`the latest issued subject on the bsp list`), 
      url: z.string().describe(`url of the signed document.`)
    }),
    func: async ({ number, subject, url }) => {
        const existing_bsp = await BSPRegulations.list({})
        for(var i in existing_bsp.data) {
            for(var j in bsp_arr) {
                if(bsp_arr[j].number.length < 4) {
                  return 'Invalid format of bsp issuance number.'
                }
                if(bsp_arr[j].number !== existing_bsp.data[i].number && bsp_arr[j].date_issued !== existing_bsp.data[i].date_issued) {
                    // console.log(bsp_arr[j].number, 'BSP_ISSUANCE', bsp_arr[j].date_issued, bsp_arr[j].subject, bsp_arr[j].url)
                    await BSPRegulations.create(bsp_arr[j].number, 'BSP_ISSUANCE', bsp_arr[j].date_issued, bsp_arr[j].subject, bsp_arr[j].url)
                    return `BSP Issuance with ${bsp_arr[j].number} is saved to database.`
                }
            }
        }
    }
  })
}