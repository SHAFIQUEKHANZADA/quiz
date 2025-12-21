import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const STATUS_VALUES = new Set(["fail", "good", "better", "excellent"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, namesPresented, answersSubmitted, score, status } = body ?? {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      !Array.isArray(namesPresented) ||
      !Array.isArray(answersSubmitted) ||
      typeof score !== "number" ||
      !STATUS_VALUES.has(status)
    ) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("memory_results").insert({
      email,
      names_presented: namesPresented,
      answers_submitted: answersSubmitted,
      score,
      status,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("/api/results failure", error);
    return NextResponse.json(
      { error: "Unable to persist result." },
      { status: 500 }
    );
  }
}
