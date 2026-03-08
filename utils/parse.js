/**
 * Robust JSON parsing with fallback chain.
 * Handles common LLM output quirks: markdown fences, preamble text, etc.
 */

export function parseAnalysisJSON(text) {
  if (!text || typeof text !== "string") return null;

  // Attempt 1: direct parse
  try {
    return JSON.parse(text);
  } catch {}

  // Attempt 2: strip markdown fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {}
  }

  // Attempt 3: extract first { to last }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}
