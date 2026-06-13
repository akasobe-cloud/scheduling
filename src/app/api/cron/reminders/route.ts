import { NextRequest, NextResponse } from "next/server";
import { addMinutes, addHours } from "date-fns";
import { formatDateTimeJa } from "@/lib/google-calendar";
import { buildReminderEmail, sendEmail } from "@/lib/gmail";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { BookingWithAdvisor } from "@/types";

const REMINDER_WINDOW_MINUTES = 15;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();

    // 前日リマインド: 開始24時間前 ±15分
    const dayTargetStart = addHours(now, 24 - REMINDER_WINDOW_MINUTES / 60);
    const dayTargetEnd = addHours(now, 24 + REMINDER_WINDOW_MINUTES / 60);

    // 1時間前リマインド: 開始1時間前 ±15分
    const hourTargetStart = addMinutes(now, 60 - REMINDER_WINDOW_MINUTES);
    const hourTargetEnd = addMinutes(now, 60 + REMINDER_WINDOW_MINUTES);

    const { data: dayBookings, error: dayError } = await supabase
      .from("bookings")
      .select("*, advisors(name, email)")
      .eq("status", "confirmed")
      .eq("reminder_day_sent", false)
      .gte("start_time", dayTargetStart.toISOString())
      .lte("start_time", dayTargetEnd.toISOString());

    if (dayError) throw new Error(dayError.message);

    const { data: hourBookings, error: hourError } = await supabase
      .from("bookings")
      .select("*, advisors(name, email)")
      .eq("status", "confirmed")
      .eq("reminder_hour_sent", false)
      .gte("start_time", hourTargetStart.toISOString())
      .lte("start_time", hourTargetEnd.toISOString());

    if (hourError) throw new Error(hourError.message);

    let daySent = 0;
    let hourSent = 0;

    for (const booking of (dayBookings || []) as BookingWithAdvisor[]) {
      await sendReminders(booking, "day");
      await supabase
        .from("bookings")
        .update({ reminder_day_sent: true })
        .eq("id", booking.id);
      daySent++;
    }

    for (const booking of (hourBookings || []) as BookingWithAdvisor[]) {
      await sendReminders(booking, "hour");
      await supabase
        .from("bookings")
        .update({ reminder_hour_sent: true })
        .eq("id", booking.id);
      hourSent++;
    }

    return NextResponse.json({
      success: true,
      dayRemindersSent: daySent,
      hourRemindersSent: hourSent,
      processedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Reminder cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

async function sendReminders(
  booking: BookingWithAdvisor,
  reminderType: "day" | "hour"
): Promise<void> {
  const startTime = new Date(booking.start_time);
  const dateTimeStr = formatDateTimeJa(startTime);
  const advisorName = booking.advisors.name;
  const advisorEmail = booking.advisors.email;

  if (!booking.zoom_join_url) return;

  const seekerEmailContent = buildReminderEmail({
    recipientName: booking.seeker_name,
    isAdvisor: false,
    seekerName: booking.seeker_name,
    advisorName,
    dateTime: dateTimeStr,
    zoomJoinUrl: booking.zoom_join_url,
    reminderType,
  });

  const advisorEmailContent = buildReminderEmail({
    recipientName: advisorName,
    isAdvisor: true,
    seekerName: booking.seeker_name,
    advisorName,
    dateTime: dateTimeStr,
    zoomJoinUrl: booking.zoom_join_url,
    reminderType,
  });

  await Promise.all([
    sendEmail({
      to: booking.seeker_email,
      subject: seekerEmailContent.subject,
      htmlBody: seekerEmailContent.html,
    }),
    sendEmail({
      to: advisorEmail,
      subject: advisorEmailContent.subject,
      htmlBody: advisorEmailContent.html,
    }),
  ]);
}
