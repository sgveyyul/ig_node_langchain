require('dotenv').config();
const nodemailer = require('nodemailer');

const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

exports.sendEmailTool = async () => {
  return new DynamicStructuredTool({
    name: "send-email",
    description: "if you want to send an email to a user, user this tool.",
    schema: z.object({
      to: z.string().describe("the email we will send to"),
      subject: z.string().describe("the subject of the email"),
      body: z.string().describe("the message of the email"),
      date: z.string().describe(`the latest issued date on the bsp list`)
    }),
    func: async ({ to, subject, body, date }) =>{
      console.log({ to, subject, body, date })
      await send_email(to, subject, body)
    }
       // Outputs still must be strings
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
    throw error; // You can rethrow the error to handle it in the calling code.
  }
}