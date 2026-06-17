import { google } from "googleapis";
import { addMinutes, format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type { Advisor } from "@/types";
import { getGooglePrivateKey } from "./env";

const TIMEZONE = process.env.TIMEZONE || "Asia/Tokyo";

function getAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getGooglePrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("Google Service Account credentials are not configured");
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

export function getCalendarClient() {
  const auth = getAuthClient();
  return google.calendar({ version: "v3", auth });
}

export async function getBusyTimes(
  advisors: Advisor[],
  startDate: Date,
  endDate: Date
): Promise<Map<string, { start: Date; end: Date }[]>> {
  const calendar = getCalendarClient();

  const items = advisors.map((advisor) => ({
    id: advisor.google_calendar_id,
  }));

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      timeZone: TIMEZONE,
      items,
    },
  });

  const busyMap = new Map<string, { start: Date; end: Date }[]>();

  for (const advisor of advisors) {
    const calendarId = advisor.google_calendar_id;
    const busy = response.data.calendars?.[calendarId]?.busy || [];
    busyMap.set(
      advisor.id,
      busy.map((b) => ({
        start: new Date(b.start!),
        end: new Date(b.end!),
      }))
    );
  }

  return busyMap;
}

export function generateTimeSlots(
  dateStr: string,
  durationMinutes: number,
  businessStartHour: number,
  businessEndHour: number
): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = [];
  const zonedDate = toZonedTime(parseISO(`${dateStr}T00:00:00`), TIMEZONE);

  for (let hour = businessStartHour; hour < businessEndHour; hour++) {
    for (let minute = 0; minute < 60; minute += durationMinutes) {
      const slotStartLocal = new Date(zonedDate);
      slotStartLocal.setHours(hour, minute, 0, 0);

      const slotEndLocal = addMinutes(slotStartLocal, durationMinutes);
      const endHour = slotEndLocal.getHours();
      const endMinute = slotEndLocal.getMinutes();

      if (endHour > businessEndHour || (endHour === businessEndHour && endMinute > 0)) {
        continue;
      }

      const slotStart = fromZonedTime(slotStartLocal, TIMEZONE);
      const slotEnd = fromZonedTime(slotEndLocal, TIMEZONE);

      if (slotStart > new Date()) {
        slots.push({ start: slotStart, end: slotEnd });
      }
    }
  }

  return slots;
}

export function isSlotAvailableForAnyAdvisor(
  slotStart: Date,
  slotEnd: Date,
  allBusyTimes: Map<string, { start: Date; end: Date }[]>
): boolean {
  for (const busyTimes of allBusyTimes.values()) {
    const isBusy = busyTimes.some(
      (busy) => slotStart < busy.end && slotEnd > busy.start
    );
    if (!isBusy) {
      return true;
    }
  }
  return false;
}

export function isAdvisorFreeAtSlot(
  slotStart: Date,
  slotEnd: Date,
  busyTimes: { start: Date; end: Date }[]
): boolean {
  return !busyTimes.some(
    (busy) => slotStart < busy.end && slotEnd > busy.start
  );
}

export async function createCalendarEvent(params: {
  calendarId: string;
  summary: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendeeEmails: string[];
  zoomJoinUrl?: string;
  advisorEmail?: string;
}): Promise<string> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getGooglePrivateKey();
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: params.advisorEmail, // CAになりすまして書き込む
  });
  const calendar = google.calendar({ version: "v3", auth });

  const description = params.zoomJoinUrl
    ? `${params.description}\n\nZoom: ${params.zoomJoinUrl}`
    : params.description;

  const event = await calendar.events.insert({
    calendarId: params.calendarId,
    requestBody: {
      summary: params.summary,
      description,
      start: {
        dateTime: params.startTime.toISOString(),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: params.endTime.toISOString(),
        timeZone: TIMEZONE,
      },
      attendees: params.attendeeEmails.map((email) => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "popup", minutes: 1440 },
        ],
      },
    },
    sendUpdates: "all",
  });

  return event.data.id || "";
}

export async function deleteCalendarEvent(params: {
  calendarId: string;
  eventId: string;
  advisorEmail: string;
}): Promise<void> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getGooglePrivateKey();
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: params.advisorEmail,
  });
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.delete({
    calendarId: params.calendarId,
    eventId: params.eventId,
  });
}

export function formatDateTimeJa(date: Date): string {
  const zoned = toZonedTime(date, TIMEZONE);
  return format(zoned, "yyyy年M月d日(E) HH:mm", { locale: ja });
}

export { TIMEZONE };
