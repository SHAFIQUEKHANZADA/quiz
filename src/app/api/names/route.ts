import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const DISPLAY_COUNT = 20;

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("memory_names")
      .select("name")
      .eq("active", true);

    if (error) {
      throw error;
    }

    const allNames = (data ?? []).map((row) => row.name).filter(Boolean);
    const names = shuffle(allNames).slice(0, DISPLAY_COUNT);

    if (names.length < DISPLAY_COUNT) {
      return NextResponse.json(
        { error: "Not enough active names in memory_names table." },
        { status: 422 }
      );
    }

    return NextResponse.json({ names, poolSize: allNames.length });
  } catch (error) {
    console.error("/api/names failure", error);
    return NextResponse.json(
      { error: "Unable to load names from Supabase." },
      { status: 500 }
    );
  }
}
