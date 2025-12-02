import nodemailer from "nodemailer";
import logger from "./logger";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number.parseInt(process.env.SMTP_PORT, 10) : undefined;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromAddress = process.env.EMAIL_FROM || "no-reply@tech4climate.local";

let transporter: nodemailer.Transporter | null = null;
if (smtpHost && smtpPort && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
} else {
  logger.warn("SMTP not fully configured; emails will be logged to console");
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html,
      });
      logger.info("Email sent", { to, subject, messageId: info.messageId });
      return { success: true };
    } catch (err: any) {
      logger.error("Failed to send email", { err: err.message, to, subject });
      return { success: false, error: err.message };
    }
  }

  // Fallback: log the email and return success
  logger.info("Email (logged only)", { to, subject, text });
  return { success: true };
}
