export type Advisor = {
  id: string;
  name: string;
  email: string;
  google_calendar_id: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Booking = {
  id: string;
  advisor_id: string;
  seeker_name: string;
  seeker_email: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  zoom_meeting_id: string | null;
  zoom_join_url: string | null;
  zoom_start_url: string | null;
  google_event_id: string | null;
  status: "confirmed" | "cancelled";
  reminder_day_sent: boolean;
  reminder_hour_sent: boolean;
  created_at: string;
};

export type BookingWithAdvisor = Booking & {
  advisors: Pick<Advisor, "name" | "email">;
};

export type TimeSlot = {
  start: string;
  end: string;
  available: boolean;
};

export type AvailabilityResponse = {
  date: string;
  slots: TimeSlot[];
};

export type AdvisorsResponse = {
  advisors: Pick<Advisor, "id" | "name" | "email" | "sort_order" | "is_active">[];
};

export type BookRequest = {
  seekerName: string;
  seekerEmail: string;
  startTime: string;
};

export type BookResponse = {
  success: boolean;
  bookingId?: string;
  advisorName?: string;
  startTime?: string;
  endTime?: string;
  zoomJoinUrl?: string;
  error?: string;
};
