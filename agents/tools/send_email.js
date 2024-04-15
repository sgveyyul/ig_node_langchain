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

exports.sendEmailTool = async () => {
  return new DynamicStructuredTool({
    name: "send-email",
    description: "if you want to send an email to a user, user this tool.",
    schema: z.object({
      to: z.string().array().describe("array of user emails we will send out to"),
      subject: z.string().describe("the subject of the email"),
      body: z.string().describe("the message of the email"),
      date: z.string().describe(`the latest issued date on the bsp list`),
      number: z.string().describe(`the latest issued number on the bsp list`),
      bsp_subject: z.string().describe(`the latest issued subject on the bsp list`),
      bsp_arr: z.array(bspSchema).describe(`object list list C.`)
    }),
    func: async ({ to, subject, body, date, number, bsp_subject, bsp_arr }) => {
      console.log('emails', to, bsp_arr)
      const bsp_issuances = await BSPRegulations.listAll()
      console.log('bsp_issuances', bsp_issuances)
      const latestBSPIssuance = {
        date: date,
        number: number,
        bsp_subject: bsp_subject
      };
      console.log('latestBSPIssuance', latestBSPIssuance)
      if(bsp_issuances && bsp_issuances.data && bsp_issuances.data.length > 0) {
        // validate data
        if(latestBSPIssuance.number.length < 4) {
          return 'Invalid format of bsp issuance number.'
        }
        const exists = bsp_issuances.data.some(issuance =>
          issuance.number === latestBSPIssuance.number &&
          issuance.date_issued === latestBSPIssuance.date &&
          issuance.subject === latestBSPIssuance.bsp_subject
        );
        if(!exists) {
          console.log('not exists')
          for(var i in to) {
            await send_email(to[i], subject, body)
          }
          return `The email was sent to the followning emails ${to.map(v => `"${v}"`).join(', ')}. the subject of the email was ${subject}. The body of the email is ${body}.`
        } else {
          return 'There are no new bsop issuances'
        }
      } else {
        return 'Table bsp_issuance is empty.'
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