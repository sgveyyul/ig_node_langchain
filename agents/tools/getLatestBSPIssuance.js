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
    description: "If you want to compare the scraped bsp issuances with the existing bsp issuances in the database to check if there are new issuances, use this tool.",
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
        return `Here are the bsp issuance that are in list A ${JSON.stringify(uniqueInA, null, 2)} but not in our existing database.`
      } else {
        return `There are now new bsp issuances.`
      }
      
    }
  })
}

const send_email = async(to, subject, body) => {
  try {
    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      }
    });
    
    let info = await transporter.sendMail({
      from: '"IntelliGo-noreply" <anderson.bondoc@ph.ey.com>',
      to: to,
      subject: subject,
      html: body,
    });

    console.log('sendMail details: ', subject, info);
    
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('Error sending email:', error.stack);
    throw error; // You can rethrow the error to handle it in the calling code.
  }
}