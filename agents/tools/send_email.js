require('dotenv').config();
const nodemailer = require('nodemailer');

const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");


const _ = require('lodash');

const bspSchema = z.object({
  number: z.string().describe(`the number of the bsp issuance`),
  date_issued: z.string().describe(`the issued date of the bsp issuance`),
  subject: z.string().describe(`the subject of the bsp issuance`),
  url: z.string().describe(`the url link of the bsp list`)
});

exports.sendEmailTool = async () => {
  try {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    
    return new DynamicStructuredTool({
      name: "send-email",
      description: "if you want to send an email to a user, user this tool.",
      schema: z.object({
        to: z.string().array().describe("array of user emails we will send out to"),
        subject: z.string().describe("the subject of the email"),
        body: z.string().describe("the message of the email"),
        bsp_arr: z.array(bspSchema).describe(`list of all new bsp issuances in conversation.`)
      }),
      func: async ({ to, subject, body, bsp_arr }) => {
        // validate data
        console.log('sendEmailTool', bsp_arr)
        if(bsp_arr && bsp_arr.length > 0) {
          for(var i in bsp_arr) {
            if(bsp_arr[i].number && bsp_arr[i].number.length < 4) {
              return `I encountered an error when validating the data. No email was sent.`
            }
            if(bsp_arr[i].date_issued && !regex.test(bsp_arr[i].date_issued )) {
              return `I encountered an error when validating the data. No email was sent.`
            }
          }
          
          for(var i in to) {
            await send_email(to[i], subject, body)
          }
          return `The email was sent successfully.`
        } else {
          return `No email was sent since there are no new bsp issuances.`
        }
      }
    })
  } catch(e) {
    return `Error ${e}`
  }
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