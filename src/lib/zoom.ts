interface ZoomMeetingResponse {
  id: number;
  join_url: string;
  start_url: string;
  password?: string;
}

export async function createZoomMeeting(params: {
  topic: string;
  startTime: Date;
  durationMinutes: number;
  agenda?: string;
}): Promise<{ meetingId: string; joinUrl: string; startUrl: string }> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom credentials are not configured");
  }

  const tokenResponse = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
    }
  );

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Zoom token error: ${error}`);
  }

  const { access_token: accessToken } = await tokenResponse.json();

  const meetingResponse = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: params.topic,
      type: 2,
      start_time: params.startTime.toISOString(),
      duration: params.durationMinutes,
      timezone: process.env.TIMEZONE || "Asia/Tokyo",
      agenda: params.agenda || "",
      settings: {
        join_before_host: true,
        waiting_room: true,
        auto_recording: "none",
      },
    }),
  });

  if (!meetingResponse.ok) {
    const error = await meetingResponse.text();
    throw new Error(`Zoom meeting creation error: ${error}`);
  }

  const meeting: ZoomMeetingResponse = await meetingResponse.json();

  return {
    meetingId: String(meeting.id),
    joinUrl: meeting.join_url,
    startUrl: meeting.start_url,
  };
}
