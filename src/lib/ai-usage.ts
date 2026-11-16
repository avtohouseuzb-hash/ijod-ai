import type { SupabaseClient } from "@supabase/supabase-js";

type UsageSource = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  [key: string]: unknown;
};

export async function recordAiUsage(
  service: SupabaseClient,
  input: {
    userId: string;
    requestId?: string | null;
    feature: string;
    model: string;
    usage?: UsageSource | null;
  },
): Promise<void> {
  const usage = input.usage ?? null;
  const inputTokens = usage
    ? (Number.isFinite(usage.input_tokens) ? Number(usage.input_tokens) : Number.isFinite(usage.prompt_tokens) ? Number(usage.prompt_tokens) : null)
    : null;
  const outputTokens = usage
    ? (Number.isFinite(usage.output_tokens) ? Number(usage.output_tokens) : Number.isFinite(usage.completion_tokens) ? Number(usage.completion_tokens) : null)
    : null;
  const reportedTotal = usage && Number.isFinite(usage.total_tokens) ? Number(usage.total_tokens) : null;
  const totalTokens = reportedTotal ?? (inputTokens !== null || outputTokens !== null
    ? (inputTokens ?? 0) + (outputTokens ?? 0)
    : null);
  const usageAvailable = totalTokens !== null;

  const { error } = await service.from("ai_usage_events").insert({
    user_id: input.userId,
    request_id: input.requestId ?? null,
    feature: input.feature.slice(0, 80),
    model: input.model.slice(0, 100),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    usage_available: usageAvailable,
    raw_usage: usage ? {
      input_tokens: usage.input_tokens ?? usage.prompt_tokens ?? null,
      output_tokens: usage.output_tokens ?? usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
    } : {},
  });

  if (error) {
    // Usage logging must never turn a successful generation into a failed request.
    console.error("AI usage event could not be saved:", error.message);
  }
}
