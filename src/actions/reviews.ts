"use server";

import { createClient } from "@/lib/supabase/server";
import type { Smiley } from "@/lib/types";

interface SubmitReviewInput {
  artisanId: string;
  content: string;
  smiley: Smiley;
}

export async function submitReview({ artisanId, content, smiley }: SubmitReviewInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthenticated" as const };
  }

  const { error } = await supabase.from("reviews").upsert(
    {
      artisan_id: artisanId,
      user_id: user.id,
      content,
      smiley,
    },
    { onConflict: "artisan_id,user_id" }
  );

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
