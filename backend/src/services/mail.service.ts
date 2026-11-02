import fs from 'fs';
import path from 'path';
import nodemailer, { type Transporter } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { accountCreatedEmail, accountCreatedUrls, adminPartnerKycEmail, partnerApprovedEmail, partnerCredentialsEmail, passwordResetEmail, passwordResetOtpEmail, type AccountCreatedEmailData } from './mail.templates';

let transporter: Transporter | null = null;

/** Created lazily so env vars are read after dotenv.config() has run. */
function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/** backend/assets/email/logo.png. Same relative path from src/services and dist/services. */
const LOGO_PATH = path.resolve(__dirname, '../../assets/email/logo.png');
const LOGO_CID = 'homecarex-logo';

/**
 * Logo for the email header. MAIL_LOGO_URL (a public https image) wins if set;
 * otherwise the PNG is attached inline (cid:) so it shows without any hosting.
 */
function logo(): { src?: string; attachments: Mail.Attachment[] } {
  const url = process.env.MAIL_LOGO_URL;
  if (url) return { src: url, attachments: [] };
  if (fs.existsSync(LOGO_PATH)) {
    return { src: `cid:${LOGO_CID}`, attachments: [{ filename: 'homecarex-logo.png', path: LOGO_PATH, cid: LOGO_CID }] };
  }
  return { attachments: [] }; // falls back to a text wordmark
}

const _escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);

export const mailService = {
  async sendAccountCreatedEmail(data: Omit<AccountCreatedEmailData, 'loginUrl' | 'profileUrl' | 'logoSrc' | 'supportEmail'>) {
    const frontendUrl = process.env.FRONTEND_URL
      || (process.env.APP_LOGIN_URL ? new URL(process.env.APP_LOGIN_URL).origin : 'http://localhost:3000');
    const urls = accountCreatedUrls(data.role, frontendUrl);
    const { src, attachments } = logo();
    const { subject, html, text } = accountCreatedEmail({
      ...data,
      ...urls,
      logoSrc: src,
      supportEmail: process.env.SUPPORT_EMAIL,
    });

    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: data.email,
      subject,
      text,
      html,
      attachments,
    });
  },

  async sendPartnerCredentials(to: { name: string; email: string; designation: string }, password: string) {
    const { src, attachments } = logo();
    const { subject, html, text } = partnerCredentialsEmail({
      ...to,
      password,
      loginUrl: process.env.APP_LOGIN_URL || 'http://localhost:5173/login',
      logoSrc: src,
      supportEmail: process.env.SUPPORT_EMAIL,
    });

    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: to.email,
      subject,
      text,
      html,
      attachments,
    });
  },

  async sendPasswordResetEmail(data: { name: string; email: string; resetUrl: string }) {
    const { src, attachments } = logo();
    const { subject, html, text } = passwordResetEmail({
      ...data,
      logoSrc: src,
      supportEmail: process.env.SUPPORT_EMAIL,
    });

    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: data.email,
      subject,
      text,
      html,
      attachments,
    });
  },

  async sendPasswordResetOtpEmail(data: { name: string; email: string; otp: string }) {
    const { src, attachments } = logo();
    const { subject, html, text } = passwordResetOtpEmail({
      ...data,
      logoSrc: src,
      supportEmail: process.env.SUPPORT_EMAIL,
    });

    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: data.email,
      subject,
      text,
      html,
      attachments,
    });
  },

  /** Partner KYC approved: link to set a new password (login is blocked until they do). */
  async sendPartnerApprovedEmail(data: { name: string; email: string; setPasswordUrl: string; validHours: number }) {
    const { src, attachments } = logo();
    const { subject, html, text } = partnerApprovedEmail({ ...data, logoSrc: src, supportEmail: process.env.SUPPORT_EMAIL });

    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: data.email,
      subject,
      text,
      html,
      attachments,
    });
  },

  /** Tells the admin team a partner is waiting for KYC review. `to` may hold several addresses. */
  async sendAdminPartnerKycEmail(to: string[], data: { partnerName: string; partnerEmail: string; partnerPhone?: string; category?: string; reviewUrl: string }) {
    if (to.length === 0) return;
    const { src, attachments } = logo();
    const { subject, html, text } = adminPartnerKycEmail({ ...data, logoSrc: src, supportEmail: process.env.SUPPORT_EMAIL });

    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
      attachments,
    });
  },

  async sendStaffInviteEmail(data: { name: string; email: string; inviteUrl: string; invitedBy?: string }) {
    const { attachments } = logo();
    const subject = 'You have been invited to join HomeCareX';
    const text = `Hello ${data.name},\n\nYou have been invited to join HomeCareX${data.invitedBy ? ` by ${data.invitedBy}` : ''}.\nPlease accept your invite by visiting: ${data.inviteUrl}\n\nHomeCareX Team`;
    const html = `<p>Hello ${data.name},</p><p>You have been invited to join HomeCareX${data.invitedBy ? ` by ${data.invitedBy}` : ''}.</p><p><a href="${data.inviteUrl}">Accept Invite</a></p><p>HomeCareX Team</p>`;

    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: data.email,
      subject,
      text,
      html,
      attachments,
    });
  },
};

export default mailService;
