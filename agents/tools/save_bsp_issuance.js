require('dotenv').config();
const nodemailer = require('nodemailer');

const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

const BSPIssuance= require('../../models/bsp_issuance');

exports.saveBSPIssuance = async () => {
  return new DynamicStructuredTool({
    name: "save-bsp-issuance",
    description: "Tool for saving bsp issuances in the database.",
    schema: z.object({
      bsp_issuances: z.array().describe("the all latest bsp issuance")
    }),
    func: async ({ bsp_issuances }) => {
        const existing_bsp = await BSPIssuance.listAll()
        for(var ebsp in existing_bsp) {
            for(var bsp in bsp_issuances) {
                if(bsp.number !== ebsp.number && bsp.date !== ebsp.date) {
                    console.log(`saving ${number}, ${date_issued}, ${subject}, ${url}`)
                    // await BSPIssuance.create(number, date_issued, subject, url)
                }
            }
        }
    }
  })
}