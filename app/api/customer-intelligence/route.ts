import { NextResponse } from "next/server";

type Payload = {
  context?: string;
  rawText?: string;
  warnings?: string[];
};

type IntelResult = {
  id: string;
  createdAt: string;
  overview: string;
  sentiment: "positive" | "neutral" | "negative";
  churnRisk: "LOW" | "MEDIUM" | "HIGH";
  opportunity: string;
  recommendation: string;
  confidence: number;
  signals: string[];
  warnings: string[];
  relatedRows: number;
  feedbackSummary: Array<{
    customer: string;
    sentiment: "positive" | "neutral" | "negative";
    category: string;
    note: string;
  }>;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function splitSnippets(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|(?:^|\n)(?:[-*•]|(?:\d+[\).]))\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function inferSentiment(text: string): "positive" | "neutral" | "negative" {
  const lower = text.toLowerCase();
  const positiveHits = (lower.match(/\b(good|great|excellent|amazing|awesome|love|loved|liked|satisfied|happy|helpful|quick|smooth|nice)\b/g) || []).length;
  const negativeHits =
    (lower.match(/\b(bad|poor|terrible|awful|hate|hated|unhappy|disappointed|dissatisfied|slow|late|delay|issue|problem|complaint|refund|confusing|rude)\b/g) || []).length +
    (lower.match(/\b(did not|didn't|do not|don't|was not|wasn't|were not|weren't|not)\b.*\b(like|love|enjoy|satisfied|happy|good|great|helpful)\b/g) || []).length;
  if (negativeHits > positiveHits) return "negative";
  if (positiveHits > negativeHits) return "positive";
  return "neutral";
}

function buildResult(rawText: string): IntelResult {
  const snippets = splitSnippets(rawText);
  const scored = snippets.map((snippet) => ({ snippet, sentiment: inferSentiment(snippet) }));
  const positive = scored.filter((item) => item.sentiment === "positive").length;
  const negative = scored.filter((item) => item.sentiment === "negative").length;
  const sentiment = negative > positive ? "negative" : positive > negative ? "positive" : "neutral";
  const churnRisk = negative > positive + 1 ? "HIGH" : negative > 0 ? "MEDIUM" : "LOW";
  const confidence = clamp(62 + scored.length * 3 + positive * 2 - negative * 5, 52, 96);

  return {
    id: `customer-intel-${Date.now()}`,
    createdAt: new Date().toISOString(),
    overview: `The text leans ${sentiment} with ${positive} positive and ${negative} negative snippets across ${scored.length} segments.`,
    sentiment,
    churnRisk,
    opportunity: positive > negative ? "Retention and referral growth" : "Service recovery and win-back",
    recommendation:
      negative > 0
        ? "Address the negative comments first, then close the loop with a direct recovery action."
        : "Turn the strongest positive themes into a repeatable customer playbook.",
    confidence,
    signals: [
      scored.length > 0 ? `${scored.length} text segments analyzed.` : "No readable text segments were found.",
      positive > 0 ? `${positive} positive mentions were detected.` : "Positive mentions are limited.",
      negative > 0 ? `${negative} negative mentions need attention.` : "No strong negative language was detected.",
    ],
    warnings:
      negative > 0
        ? ["Negative sentiment is present in the pasted text.", "Churn risk rises when complaints repeat."]
        : ["No strong warning pattern was found in the text."],
    relatedRows: scored.length,
    feedbackSummary: scored.map((item, index) => ({
      customer: `Snippet ${index + 1}`,
      sentiment: item.sentiment,
      category: "Text input",
      note: item.snippet,
    })),
  };
}

async function callGroq(payload: Payload): Promise<IntelResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const prompt = [
    "You are a customer intelligence analyst.",
    "Return ONLY valid JSON with the following shape:",
    "{",
    '  "overview": string,',
    '  "sentiment": "positive" | "neutral" | "negative",',
    '  "churnRisk": "LOW" | "MEDIUM" | "HIGH",',
    '  "opportunity": string,',
    '  "recommendation": string,',
    '  "confidence": number,',
    '  "signals": string[],',
    '  "warnings": string[]',
    "}",
    "Use the raw text and context provided below.",
    JSON.stringify(payload),
  ].join("\n");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You analyze customer feedback and produce concise business intelligence." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq response did not include content.");

  const parsed = JSON.parse(content as string);
  const snippets = splitSnippets(payload.rawText ?? "");

  return {
    id: `customer-intel-${Date.now()}`,
    createdAt: new Date().toISOString(),
    overview: String(parsed.overview ?? "Customer intelligence generated."),
    sentiment: parsed.sentiment === "positive" || parsed.sentiment === "negative" ? parsed.sentiment : "neutral",
    churnRisk: parsed.churnRisk === "HIGH" || parsed.churnRisk === "MEDIUM" ? parsed.churnRisk : "LOW",
    opportunity: String(parsed.opportunity ?? "Loyalty expansion"),
    recommendation: String(parsed.recommendation ?? "Review the latest customer feedback."),
    confidence: clamp(Number(parsed.confidence ?? 78), 0, 100),
    signals: Array.isArray(parsed.signals) ? parsed.signals.map(String).slice(0, 6) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).slice(0, 6) : [],
    relatedRows: snippets.length,
    feedbackSummary: snippets.map((snippet, index) => ({
      customer: `Snippet ${index + 1}`,
      sentiment: inferSentiment(snippet),
      category: "Text input",
      note: snippet,
    })),
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;
    const groq = await callGroq(payload);
    const base = groq ?? buildResult(payload.rawText ?? "");
    return NextResponse.json({
      ...base,
      warnings: payload.warnings?.length ? [...base.warnings, ...payload.warnings].slice(0, 6) : base.warnings,
    });
  } catch {
    return NextResponse.json(buildResult(""), { status: 200 });
  }
}
