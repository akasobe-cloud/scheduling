import { NextRequest, NextResponse } from "next/server";
import { addDays, parseISO } from "date-fns";
import {
  generateTimeSlots,
  getBusyTimes,
  isSlotAvailableForAnyAdvisor,
} from "@/lib/google-calendar";
import { getActiveAdvisors } from "@/lib/round-robin";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { AvailabilityResponse, TimeSlot } from "@/types";

const DURATION_MINUTES = Number(process.env.APPOINTMENT_DURATION_MINUTES || 60);
const BUSINESS_START_HOUR = Number(process.env.BUSINESS_START_HOUR || 10);
const BUSINESS_END_HOUR = Number(process.env.BUSINESS_END_HOUR || 18);
const MAX_BOOKING_DAYS = Number(process.env.MAX_BOOKING_DAYS || 14);

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date");

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: "date parameter is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const requestedDate = parseISO(dateParam);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = addDays(today, MAX_BOOKING_DAYS);
    if (requestedDate < today || requestedDate > maxDate) {
      return NextResponse.json(
        { error: `Date must be within the next ${MAX_BOOKING_DAYS} days` },
        { status: 400 }
      );
    }

    const advisors = await getActiveAdvisors();
    if (advisors.length === 0) {
      return NextResponse.json({ error: "No advisors configured" }, { status: 503 });
    }

    const slots = generateTimeSlots(
      dateParam,
      DURATION_MINUTES,
      BUSINESS_START_HOUR,
      BUSINESS_END_HOUR
    );

    if (slots.length === 0) {
      const response: AvailabilityResponse = { date: dateParam, slots: [] };
      return NextResponse.json(response);
    }

    const dayStart = slots[0].start;
    const dayEnd = slots[slots.length - 1].end;

    const busyTimes = await getBusyTimes(advisors, dayStart, dayEnd);

    const supabase = getSupabaseAdmin();
    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("advisor_id, start_time, end_time")
      .eq("status", "confirmed")
      .gte("start_time", dayStart.toISOString())
      .lte("start_time", dayEnd.toISOString());

    for (const booking of existingBookings || []) {
      const advisorBusy = busyTimes.get(booking.advisor_id) || [];
      advisorBusy.push({
        start: new Date(booking.start_time),
        end: new Date(booking.end_time),
      });
      busyTimes.set(booking.advisor_id, advisorBusy);
    }

    const availableSlots: TimeSlot[] = slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      available: isSlotAvailableForAnyAdvisor(slot.start, slot.end, busyTimes),
    }));

    const response: AvailabilityResponse = {
      date: dateParam,
      slots: availableSlots,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Availability error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
