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
  seekerEmail?: string;
  seekerCompany?: string;
  advisorName: string;
  dateTime: string;
  zoomJoinUrl: string;
  zoomMeetingId?: string;
  zoomPassword?: string;
  durationMinutes: number;
  source?: string;
  recruiter?: string;
}): { subject: string; html: string } {
  if (params.isAdvisor) {
    const subject = `【予約確定】${params.seekerName}様との面談 - ${params.dateTime}【Liquet】`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
  <h2>面談予約が確定しました</h2>
  <p>${params.advisorName} 様</p>
  <p>以下の内容で面談予約が確定しました。</p>
  <table style="border-collapse: collapse; margin: 20px 0; width: 100%;">
    <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold; width: 140px;">日時</td><td style="padding: 10px;">${params.dateTime}</td></tr>
    <tr><td style="padding: 10px; font-weight: bold;">Web会議室</td><td style="padding: 10px;"><a href="${params.zoomJoinUrl}">${params.zoomJoinUrl}</a></td></tr>
    ${params.zoomMeetingId ? `<tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">ミーティングID</td><td style="padding: 10px;">${params.zoomMeetingId}</td></tr>` : ""}
    ${params.zoomPassword ? `<tr><td style="padding: 10px; font-weight: bold;">パスワード</td><td style="padding: 10px;">${params.zoomPassword}</td></tr>` : ""}
  </table>
  <table style="border-collapse: collapse; margin: 20px 0; width: 100%; border-top: 2px solid #eee;">
    <tr><td colspan="2" style="padding: 10px; font-weight: bold; font-size: 16px;">入力情報</td></tr>
    ${params.seekerCompany ? `<tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold; width: 140px;">会社名</td><td style="padding: 10px;">${params.seekerCompany}</td></tr>` : ""}
    <tr><td style="padding: 10px; font-weight: bold;">名前</td><td style="padding: 10px;">${params.seekerName}</td></tr>
    <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">メールアドレス</td><td style="padding: 10px;"><a href="mailto:${params.seekerEmail}">${params.seekerEmail}</a></td></tr>
    ${params.source ? `<tr><td style="padding: 10px; font-weight: bold;">流入媒体</td><td style="padding: 10px;">${params.source}</td></tr>` : ""}
    ${params.recruiter ? `<tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">スカウトアカウント</td><td style="padding: 10px;">${params.recruiter}</td></tr>` : ""}
  </table>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">Liquet</p>
</body>
</html>`;
    return { subject, html };
  } else {
    const subject = `【面談予約確定】${params.dateTime}【Liquet】`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
  <h2>面談予約が確定しました</h2>
  <p>${params.recipientName} 様</p>
  <table style="border-collapse: collapse; margin: 20px 0; width: 100%;">
    <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold; width: 140px;">日時</td><td style="padding: 10px;">${params.dateTime}</td></tr>
    <tr><td style="padding: 10px; font-weight: bold;">Web会議室</td><td style="padding: 10px;"><a href="${params.zoomJoinUrl}">${params.zoomJoinUrl}</a></td></tr>
    ${params.zoomMeetingId ? `<tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">ミーティングID</td><td style="padding: 10px;">${params.zoomMeetingId}</td></tr>` : ""}
    ${params.zoomPassword ? `<tr><td style="padding: 10px; font-weight: bold;">パスワード</td><td style="padding: 10px;">${params.zoomPassword}</td></tr>` : ""}
  </table>
  <p>お世話になります。</p>
  <p>この度はご面談の日程調整いただきありがとうございます。<br>
  求人情報から転職相談まで幅広い情報をご提供させていただきます。<br>
  当日は、どうぞよろしくお願いいたします。</p>
  <p>もしよろしければ下記のアドレスまで、<br>
  事前に履歴書、職務経歴書をwordの形でご送付いただけますと、<br>
  初回から確認と修正ができ、スムーズです。<br>
  <a href="mailto:liquet@careersuite.jp">liquet@careersuite.jp</a></p>
  <p>また有意義な面談実施のため、面談事前アンケートを準備しております。<br>
  お手すきの際にご回答いただけますと幸いでございます。<br>
  アンケートURL：<a href="https://forms.gle/AhvhSZCdvAKDxGde6">https://forms.gle/AhvhSZCdvAKDxGde6</a></p>
  <p>お手数をおかけいたしますが、よろしくお願いいたします。<br>
  ご不明な点がございましたら、いつでもお気軽にご連絡ください。</p>
  <p style="color: #666; font-size: 14px;">※このメールは送信専用です。ご返信いただいてもお答えできません。</p>
  <p style="color: #666; font-size: 14px;">※ 前日にリマインドメールをお送りします。</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">Liquet</p>
</body>
</html>`;
    return { subject, html };
  }
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
