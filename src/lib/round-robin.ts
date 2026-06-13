import { getSupabaseAdmin } from "./supabase";
import type { Advisor } from "@/types";

export async function getActiveAdvisors(): Promise<Advisor[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advisors")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to fetch advisors: ${error.message}`);
  return data || [];
}

export async function assignNextAdvisor(): Promise<Advisor> {
  const supabase = getSupabaseAdmin();
  const advisors = await getActiveAdvisors();

  if (advisors.length === 0) {
    throw new Error("No active advisors available");
  }

  const { data: state, error: stateError } = await supabase
    .from("round_robin_state")
    .select("last_advisor_index")
    .eq("id", 1)
    .single();

  if (stateError) throw new Error(`Failed to fetch round robin state: ${stateError.message}`);

  const nextIndex = ((state?.last_advisor_index ?? -1) + 1) % advisors.length;
  const assignedAdvisor = advisors[nextIndex];

  const { error: updateError } = await supabase
    .from("round_robin_state")
    .update({ last_advisor_index: nextIndex, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (updateError) throw new Error(`Failed to update round robin state: ${updateError.message}`);

  return assignedAdvisor;
}

export async function assignAdvisorForSlot(
  slotStart: Date,
  slotEnd: Date,
  busyTimes: Map<string, { start: Date; end: Date }[]>
): Promise<Advisor> {
  const supabase = getSupabaseAdmin();
  const advisors = await getActiveAdvisors();

  if (advisors.length === 0) {
    throw new Error("No active advisors available");
  }

  // 各CAの確定済み面談数を取得
  const { data: bookingCounts } = await supabase
    .from("bookings")
    .select("advisor_id")
    .eq("status", "confirmed");

  const countMap = new Map<string, number>();
  for (const advisor of advisors) {
    countMap.set(advisor.id, 0);
  }
  for (const booking of bookingCounts || []) {
    const current = countMap.get(booking.advisor_id) ?? 0;
    countMap.set(booking.advisor_id, current + 1);
  }

  // 空いているCAを面談数が少ない順に並べて最初の1人を選ぶ
  const availableAdvisors = advisors.filter((advisor) => {
    const advisorBusy = busyTimes.get(advisor.id) || [];
    return !advisorBusy.some(
      (busy) => slotStart < busy.end && slotEnd > busy.start
    );
  });

  if (availableAdvisors.length === 0) {
    throw new Error("No available advisor for this time slot");
  }

  availableAdvisors.sort((a, b) => (countMap.get(a.id) ?? 0) - (countMap.get(b.id) ?? 0));

  return availableAdvisors[0];
}
