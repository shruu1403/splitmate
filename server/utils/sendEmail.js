const nodemailer = require("nodemailer");
require("dotenv").config()
const { Resend } = require("resend");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// async function sendEmail({ to, subject, html }) {
//   try {
//     await transporter.sendMail({
//       from: `"SplitMate" <${process.env.EMAIL_USER}>`,
//       to,
//       subject,
//       html,
//     });
//     console.log("✅ Email sent to", to);
//   } catch (err) {
//     console.error("❌ Error sending email", err);
//     throw err;
//   }
// }

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, html }) {
  await resend.emails.send({
    from: `"SplitMate" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

module.exports = { sendEmail };
