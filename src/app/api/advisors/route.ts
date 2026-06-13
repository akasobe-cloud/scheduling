import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Advisor } from "@/types";

export type AdvisorPublic = Pick<
  Advisor,
  "id" | "name" | "email" | "sort_order" | "is_active"
>;

export type AdvisorsResponse = {
  advisors: AdvisorPublic[];
};

export async function GET(request: NextRequest) {
  try {
    const activeOnly = request.nextUrl.searchParams.get("active") === "true";
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("advisors")
      .select("id, name, email, sort_order, is_active")
      .order("sort_order", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: AdvisorsResponse = {
      advisors: data || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Advisors API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
