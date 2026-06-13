import { google } from "googleapis";
import { getGmailSenderEmail, getGooglePrivateKey } from "./env";

function getGmailClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getGooglePrivateKey();
  const senderEmail = getGmailSenderEmail();

  if (!clientEmail || !privateKey || !senderEmail) {
    throw new Error("Gmail credentials are not configured");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    subject: senderEmail,
  });

  return google.gmail({ version: "v1", auth });
}

function encodeEmail(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  htmlBody: string;
}): Promise<void> {
  const senderEmail = getGmailSenderEmail()!;
  const gmail = getGmailClient();

  const message = [
    `From: ${senderEmail}`,
    `To: ${params.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    params.htmlBody,
  ].join("\r\n");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodeEmail(message),
    },
  });
}

export function buildConfirmationEmail(params: {
  recipientName: string;
  isAdvisor: boolean;
  seekerName: string;
  advisorName: string;
  dateTime: string;
  zoomJoinUrl: string;
  durationMinutes: number;
}): { subject: string; html: string } {
  const role = params.isAdvisor ? "担当CA" : "求職者";
  const subject = params.isAdvisor
    ? `【予約確定】${params.seekerName}様との面談 - ${params.dateTime}`
    : `【予約確定】キャリア面談 - ${params.dateTime}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <h2>面談予約が確定しました</h2>
  <p>${params.recipientName} 様</p>
  <p>以下の内容で面談予約が確定しました。</p>
  <table style="border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; font-weight: bold;">日時</td><td style="padding: 8px;">${params.dateTime}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">時間</td><td style="padding: 8px;">${params.durationMinutes}分</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">求職者</td><td style="padding: 8px;">${params.seekerName}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">担当CA</td><td style="padding: 8px;">${params.advisorName}</td></tr>
  </table>
  <p><strong>Zoom参加リンク:</strong><br>
  <a href="${params.zoomJoinUrl}">${params.zoomJoinUrl}</a></p>
  <p style="color: #666; font-size: 14px;">※ 前日と1時間前にリマインドメールをお送りします。</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">キャリア面談予約システム（${role}向け通知）</p>
</body>
</html>`;

  return { subject, html };
}

export function buildReminderEmail(params: {
  recipientName: string;
  isAdvisor: boolean;
  seekerName: string;
  advisorName: string;
  dateTime: string;
  zoomJoinUrl: string;
  reminderType: "day" | "hour";
}): { subject: string; html: string } {
  const timing = params.reminderType === "day" ? "明日" : "1時間後";
  const subject = params.isAdvisor
    ? `【リマインド】${timing}の面談 - ${params.seekerName}様`
    : `【リマインド】${timing}のキャリア面談`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <h2>面談リマインド</h2>
  <p>${params.recipientName} 様</p>
  <p>${timing}に面談の予定があります。Zoomリンクをご確認ください。</p>
  <table style="border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; font-weight: bold;">日時</td><td style="padding: 8px;">${params.dateTime}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">求職者</td><td style="padding: 8px;">${params.seekerName}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">担当CA</td><td style="padding: 8px;">${params.advisorName}</td></tr>
  </table>
  <p><strong>Zoom参加リンク:</strong><br>
  <a href="${params.zoomJoinUrl}">${params.zoomJoinUrl}</a></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">キャリア面談予約システム</p>
</body>
</html>`;

  return { subject, html };
}
