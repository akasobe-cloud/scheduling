import { NextRequest, NextResponse } from "next/server";
import { addMinutes, parseISO } from "date-fns";
import {
  createCalendarEvent,
  formatDateTimeJa,
  getBusyTimes,
  isSlotAvailableForAnyAdvisor,
} from "@/lib/google-calendar";
import {
  buildConfirmationEmail,
  sendEmail,
} from "@/lib/gmail";
import { getSupabaseAdmin } from "@/lib/supabase";
import { assignAdvisorForSlot, getActiveAdvisors } from "@/lib/round-robin";
import { createZoomMeeting } from "@/lib/zoom";
import type { BookRequest, BookResponse } from "@/types";

const DURATION_MINUTES = Number(process.env.APPOINTMENT_DURATION_MINUTES || 60);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seekerName, seekerEmail, startTime, source, recruiter } = body;

    if (!seekerName?.trim() || !seekerEmail?.trim() || !startTime) {
      return NextResponse.json(
        { success: false, error: "名前、メールアドレス、日時は必須です" } satisfies BookResponse,
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(seekerEmail)) {
      return NextResponse.json(
        { success: false, error: "有効なメールアドレスを入力してください" } satisfies BookResponse,
        { status: 400 }
      );
    }

    const slotStart = parseISO(startTime);
    const slotEnd = addMinutes(slotStart, DURATION_MINUTES);

    if (slotStart <= new Date()) {
      return NextResponse.json(
        { success: false, error: "過去の日時は予約できません" } satisfies BookResponse,
        { status: 400 }
      );
    }

    const advisors = await getActiveAdvisors();
    const busyTimes = await getBusyTimes(advisors, slotStart, slotEnd);

    const supabase = getSupabaseAdmin();
    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("advisor_id, start_time, end_time")
      .eq("status", "confirmed")
      .lt("start_time", slotEnd.toISOString())
      .gt("end_time", slotStart.toISOString());

    for (const booking of existingBookings || []) {
      const advisorBusy = busyTimes.get(booking.advisor_id) || [];
      advisorBusy.push({
        start: new Date(booking.start_time),
        end: new Date(booking.end_time),
      });
      busyTimes.set(booking.advisor_id, advisorBusy);
    }

    if (!isSlotAvailableForAnyAdvisor(slotStart, slotEnd, busyTimes)) {
      return NextResponse.json(
        { success: false, error: "選択された時間帯は既に埋まっています。別の時間をお選びください。" } satisfies BookResponse,
        { status: 409 }
      );
    }

    const advisor = await assignAdvisorForSlot(slotStart, slotEnd, busyTimes);

    let zoom = { meetingId: "", joinUrl: "", startUrl: "" };
    try {
      zoom = await createZoomMeeting({
        topic: `キャリア面談: ${seekerName}様 × ${advisor.name}`,
        startTime: slotStart,
        durationMinutes: DURATION_MINUTES,
        agenda: `求職者: ${seekerName} (${seekerEmail})\n担当CA: ${advisor.name}`,
      });
    } catch (e) {
      console.warn("Zoom meeting creation skipped:", e);
    }

    let googleEventId = "";
    try {
      const descriptionLines = [
        `求職者: ${seekerName}`,
        `メール: ${seekerEmail}`,
        `担当CA: ${advisor.name}`,
        source ? `流入媒体: ${source}` : null,
        recruiter ? `スカウトアカウント: ${recruiter}` : null,
      ].filter(Boolean).join("\n");

      googleEventId = await createCalendarEvent({
        calendarId: advisor.google_calendar_id,
        summary: `初回面談: ${seekerName}様`,
        description: descriptionLines,
        startTime: slotStart,
        endTime: slotEnd,
        attendeeEmails: [seekerEmail, advisor.email],
        zoomJoinUrl: zoom.joinUrl,
      });
    } catch (e) {
      console.warn("Google Calendar event creation skipped:", e);
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        advisor_id: advisor.id,
        seeker_name: seekerName.trim(),
        seeker_email: seekerEmail.trim().toLowerCase(),
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        duration_minutes: DURATION_MINUTES,
        zoom_meeting_id: zoom.meetingId || null,
        zoom_join_url: zoom.joinUrl || null,
        zoom_start_url: zoom.startUrl || null,
        google_event_id: googleEventId || null,
        source: source || null,
        recruiter: recruiter || null,
        status: "confirmed",
      })
      .select()
      .single();

    if (bookingError) {
      throw new Error(`Failed to save booking: ${bookingError.message}`);
    }

    const dateTimeStr = formatDateTimeJa(slotStart);

    try {
      const seekerEmailContent = buildConfirmationEmail({
        recipientName: seekerName,
        isAdvisor: false,
        seekerName,
        advisorName: advisor.name,
        dateTime: dateTimeStr,
        zoomJoinUrl: zoom.joinUrl,
        durationMinutes: DURATION_MINUTES,
      });

      const advisorEmailContent = buildConfirmationEmail({
        recipientName: advisor.name,
        isAdvisor: true,
        seekerName,
        advisorName: advisor.name,
        dateTime: dateTimeStr,
        zoomJoinUrl: zoom.joinUrl,
        durationMinutes: DURATION_MINUTES,
      });

      await Promise.all([
        sendEmail({
          to: seekerEmail,
          subject: seekerEmailContent.subject,
          htmlBody: seekerEmailContent.html,
        }),
        sendEmail({
          to: advisor.email,
          subject: advisorEmailContent.subject,
          htmlBody: advisorEmailContent.html,
        }),
      ]);
    } catch (e) {
      console.warn("Email sending skipped:", e);
    }

    const response: BookResponse = {
      success: true,
      bookingId: booking.id,
      advisorName: advisor.name,
      startTime: slotStart.toISOString(),
      endTime: slotEnd.toISOString(),
      zoomJoinUrl: zoom.joinUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Booking error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "予約処理中にエラーが発生しました",
      } satisfies BookResponse,
      { status: 500 }
    );
  }
}
