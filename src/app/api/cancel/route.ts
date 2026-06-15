import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { buildCancelEmail, sendEmail } from "@/lib/gmail";
import { formatDateTimeJa } from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();

    if (!bookingId) {
      return NextResponse.json({ success: false, error: "bookingId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, advisors(*)")
      .eq("id", bookingId)
      .eq("status", "confirmed")
      .single();

    if (error || !booking) {
      return NextResponse.json({ success: false, error: "予約が見つかりません" }, { status: 404 });
    }

    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    const dateTimeStr = formatDateTimeJa(new Date(booking.start_time));
    const advisor = booking.advisors;

    try {
      const cancelEmail = buildCancelEmail({
        advisorName: advisor.name,
        seekerName: booking.seeker_name,
        seekerEmail: booking.seeker_email,
        dateTime: dateTimeStr,
      });

      await sendEmail({
        to: advisor.email,
        subject: cancelEmail.subject,
        htmlBody: cancelEmail.html,
      });
    } catch (e) {
      console.warn("Cancel email skipped:", e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json({ success: false, error: "キャンセル処理中にエラーが発生しました" }, { status: 500 });
  }
}
