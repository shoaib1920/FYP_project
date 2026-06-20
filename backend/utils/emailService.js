const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: Number(process.env.MAIL_PORT) === 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Strips HTML tags down to plain text so we can send a text/plain alternative
// alongside the HTML body — mail lacking a plain-text part is a common spam signal.
const htmlToText = (html) =>
  html
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n\n")
    .trim();

const sendEmail = async (to, subject, html) => {
  const mailOptions = {
    from: `"FYP Portal" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
    text: htmlToText(html),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📨 Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Email failed:", error);
  }
};

module.exports = sendEmail;
