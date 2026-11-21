import type { SupabaseClient } from "@supabase/supabase-js";

type TokenDetails = { audio_tokens?: number | null; image_tokens?: number | null; text_tokens?: number | null; cached_tokens?: number | null; };
type UsageSource = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  input_token_details?: TokenDetails | null;
  output_token_details?: TokenDetails | null;
  input_tokens_details?: TokenDetails | null;
  output_tokens_details?: TokenDetails | null;
};

export async function recordAiUsage(
  service: SupabaseClient,
  input: {
    userId: string;
    requestId?: string | null;
    feature: string;
    model: string;
    usage?: UsageSource | null;
    sessionId?: string | null;
    modality?: "text" | "audio" | "image" | "multimodal";
    sessionDurationMs?: number | null;
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
  const inputDetails = usage?.input_token_details ?? usage?.input_tokens_details ?? null;
  const outputDetails = usage?.output_token_details ?? usage?.output_tokens_details ?? null;
  const inputAudioTokens = inputDetails && Number.isFinite(inputDetails.audio_tokens) ? Number(inputDetails.audio_tokens) : null;
  const outputAudioTokens = outputDetails && Number.isFinite(outputDetails.audio_tokens) ? Number(outputDetails.audio_tokens) : null;
  const inputImageTokens = inputDetails && Number.isFinite(inputDetails.image_tokens) ? Number(inputDetails.image_tokens) : null;
  const cachedInputTokens = inputDetails && Number.isFinite(inputDetails.cached_tokens) ? Number(inputDetails.cached_tokens) : null;
  const inferredModality = input.modality ?? (
    inputAudioTokens !== null || outputAudioTokens !== null
      ? (inputImageTokens !== null ? "multimodal" : "audio")
      : inputImageTokens !== null ? "image" : "text"
  );

  const { error } = await service.from("ai_usage_events").insert({
    user_id: input.userId,
    request_id: input.requestId ?? null,
    feature: input.feature.slice(0, 80),
    model: input.model.slice(0, 100),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    usage_available: usageAvailable,
    session_id: input.sessionId ?? null,
    modality: inferredModality,
    input_audio_tokens: inputAudioTokens,
    output_audio_tokens: outputAudioTokens,
    input_image_tokens: inputImageTokens,
    cached_input_tokens: cachedInputTokens,
    session_duration_ms: input.sessionDurationMs ?? null,
    raw_usage: usage ?? {},
  });

  if (error) {
    // Usage logging must never turn a successful generation into a failed request.
    console.error("AI usage event could not be saved:", error.message);
  }
}
