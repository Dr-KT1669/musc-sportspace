import nodemailer from 'nodemailer'

export type MailMessage = {
  to: string
  subject: string
  text: string
  html: string
  meta?: { bookingId?: string; otp?: string }
}

export type StoredMail = MailMessage & { id: string; createdAt: string }

const mailbox: StoredMail[] = []
let seq = 1

export function isDevMailer() {
  return !process.env.SMTP_HOST
}

export function listMailbox() {
  return [...mailbox]
}

export async function sendMail(message: MailMessage) {
  const stored: StoredMail = {
    ...message,
    id: `m${seq++}`,
    createdAt: new Date().toISOString(),
  }

  if (isDevMailer()) {
    mailbox.unshift(stored)
    if (mailbox.length > 50) mailbox.pop()
    const otp = message.meta?.otp
    console.log('\n======== MUSC SportSpace OTP ========')
    console.log(`To:      ${message.to}`)
    console.log(`Subject: ${message.subject}`)
    if (otp) console.log(`Code:    ${otp}`)
    console.log(`Preview: /dev-mail`)
    console.log('=====================================\n')
    return
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === '1',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  })
  await transport.sendMail({
    from: process.env.MAIL_FROM || 'MUSC SportSpace <no-reply@sportspace.sc.mahidol.ac.th>',
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  })
}

export function otpEmail(opts: { name: string; code: string; facility: string; when: string; bookingId: string }) {
  const text = [
    `สวัสดี ${opts.name}`,
    '',
    `รหัสยืนยันการจองสนาม MUSC SportSpace คือ ${opts.code}`,
    `สนาม: ${opts.facility}`,
    `เวลา: ${opts.when}`,
    'รหัสมีอายุ 5 นาที และใช้ได้ครั้งเดียว',
    '',
    'หากคุณไม่ได้ทำรายการนี้ ไม่ต้องดำเนินการใด ๆ',
  ].join('\n')
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <p>สวัสดี ${escapeHtml(opts.name)}</p>
      <p>รหัสยืนยันการจอง <strong>MUSC SportSpace</strong></p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700">${opts.code}</p>
      <p>สนาม: ${escapeHtml(opts.facility)}<br/>เวลา: ${escapeHtml(opts.when)}</p>
      <p>รหัสมีอายุ 5 นาที</p>
    </div>`
  return {
    subject: `รหัส OTP ${opts.code} ยืนยันการจอง SportSpace`,
    text,
    html,
    meta: { bookingId: opts.bookingId, otp: opts.code },
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch)
}
