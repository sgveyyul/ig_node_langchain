require('dotenv').config();
const nodemailer = require('nodemailer');

const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

const BSPIssuance = require('../../models/bsp_issuance');

exports.saveBSPIssuance = async () => {
  const bspSchema = z.object({
      number: z.string().describe(`the number of the bsp issuance`),
      date_issued: z.string().describe(`the issued date of the bsp issuance`),
      subject: z.string().describe(`the subject of the bsp issuance`),
      url: z.string().describe(`the url link of the bsp list`)
  });

  return new DynamicStructuredTool({
    name: "save-bsp-issuance",
    description: "Tool for saving bsp issuances in the database.",
    schema: z.object({
      bsp_arr: z.array(bspSchema).describe(`object list of all bsp issuances. composed of number, date issued, subject and url.`),
    }),
    func: async ({ bsp_arr }) => {
        console.log('bsp_arr', bsp_arr)
        const existing_bsp = await BSPIssuance.listAll()
        for(var ebsp in existing_bsp.data) {
            for(var bsp in bsp_arr) {
                if(bsp.number !== ebsp.number && bsp.date !== ebsp.date) {
                    console.log(`saving ${number}, ${date_issued}, ${subject}, ${url}`)
                    await BSPIssuance.create(number, date_issued, subject, url)
                }
            }
        }
    }
  })
}