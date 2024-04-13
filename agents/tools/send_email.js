require('dotenv').config();
const nodemailer = require('nodemailer');

const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

const BSPIssuance = require('../../models/bsp_issuance');

exports.sendEmailTool = async () => {
  return new DynamicStructuredTool({
    name: "send-email",
    description: "if you want to send an email to a user, user this tool.",
    schema: z.object({
      to: z.string().describe("the email we will send to"),
      subject: z.string().describe("the subject of the email"),
      body: z.string().describe("the message of the email"),
      date: z.string().describe(`the latest issued date on the bsp list`),
      number: z.string().describe(`the latest issued number on the bsp list`),
      bsp_subject: z.string().describe(`the latest issued subject on the bsp list`)
    }),
    func: async ({ to, subject, body, date, number, bsp_subject }) => {
      const bsp_issuances = await BSPIssuance.listAll()
      console.log('bsp_issuances', bsp_issuances)
      const latestBSPIssuance = {
        date: date,
        number: number,
        bsp_subject: bsp_subject
      };
      console.log('latestBSPIssuance', latestBSPIssuance)
      if(bsp_issuances && bsp_issuances.data && bsp_issuances.data.length > 0) {
        for(var bsp in bsp_issuances.data) {
          if(latestBSPIssuance.number !== bsp.number && latestBSPIssuance.date !== bsp.date_issued) {
            await send_email(to, subject, body)
            break
          }
        }
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
      },
      secure: process.env.SMTP_SECURE
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