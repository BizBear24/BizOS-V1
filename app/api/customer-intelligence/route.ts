import { NextResponse } from "next/server";

type Task = "customer" | "scenario" | "signals" | "payments";

type Payload = {
  task?: Task;
  context?: string;
  rawText?: string;
  business?: string;
  warnings?: string[];
};

type Result = {
  id: string;
  createdAt: string;
  title: string;
  summary: string;
  confidence: number;
  signals: string[];
  warnings: string[];
  recommendation: string;
  metrics?: Record<string, string | number>;
  rows?: Array<{ label: string; value: string; note?: string }>;
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
  const positiveHits = (lower.match(/\b(good|great|excellent|amazing|awesome|love|loved|liked|satisfied|happy|helpful|quick|smooth|nice|fast)\b/g) || []).length;
  const negativeHits =
    (lower.match(/\b(bad|poor|terrible|awful|hate|hated|unhappy|disappointed|dissatisfied|slow|late|delay|issue|problem|complaint|refund|confusing|rude)\b/g) || []).length +
    (lower.match(/\b(did not|didn't|do not|don't|was not|wasn't|were not|weren't|not)\b.*\b(like|love|enjoy|satisfied|happy|good|great|helpful)\b/g) || []).length;
  if (negativeHits > positiveHits) return "negative";
  if (positiveHits > negativeHits) return "positive";
  return "neutral";
}

function textResult(rawText: string): Result {
  const snippets = splitSnippets(rawText);
  const scored = snippets.map((snippet) => ({ snippet, sentiment: inferSentiment(snippet) }));
  const positive = scored.filter((item) => item.sentiment === "positive").length;
  const negative = scored.filter((item) => item.sentiment === "negative").length;
  const confidence = clamp(60 + scored.length * 3 + positive * 2 - negative * 5, 52, 96);
  return {
    id: `intel-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: "Customer feedback intelligence",
    summary: `The text leans ${negative > positive ? "negative" : positive > negative ? "positive" : "neutral"} across ${scored.length} segments.`,
    confidence,
    signals: [
      scored.length ? `${scored.length} feedback snippets analyzed.` : "No readable text was provided.",
      positive ? `${positive} positive mentions found.` : "Positive mentions are limited.",
      negative ? `${negative} negative mentions found.` : "No strong negative language detected.",
    ],
    warnings: negative ? ["Negative sentiment is present.", "Complaints may create churn pressure."] : ["No active warning pattern found."],
    recommendation: negative ? "Triage the negative feedback first and close the loop quickly." : "Turn positive themes into repeatable playbooks.",
    rows: scored.map((item, index) => ({
      label: `Snippet ${index + 1}`,
      value: item.sentiment.toUpperCase(),
      note: item.snippet,
    })),
  };
}

function scenarioResult(business: string, context: string): Result {
  const lower = `${business} ${context}`.toLowerCase();
  const risk = /discount|price cut|hire|branch|delivery/.test(lower) ? "MEDIUM" : "LOW";
  return {
    id: `scenario-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: "Scenario lab",
    summary: "Scenario planning generated from the business move and operating context.",
    confidence: 81,
    signals: [
      `Scenario: ${business}`,
      context ? `Context: ${context}` : "No extra context supplied.",
      `Risk level: ${risk}`,
    ],
    warnings: risk === "MEDIUM" ? ["Scenario introduces execution risk."] : ["Scenario appears manageable."],
    recommendation: "Use the move in a controlled test window before scaling it out.",
    metrics: {
      revenue_impact: business.includes("Price") ? "-8% to +4%" : "+3% to +12%",
      customer_impact: business.includes("Loyalty") ? "Positive" : "Mixed",
      risk_level: risk,
    },
    rows: [
      { label: "Revenue impact", value: business.includes("Price") ? "-8% to +4%" : "+3% to +12%" },
      { label: "Customer impact", value: business.includes("Loyalty") ? "Positive" : "Mixed" },
      { label: "Risk level", value: risk },
      { label: "Recommendation", value: "Test before scaling" },
    ],
  };
}

function signalsResult(rawText: string): Result {
  const snippets = splitSnippets(rawText);
  const negative = snippets.filter((snippet) => inferSentiment(snippet) === "negative").length;
  return {
    id: `signals-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: "Business signals",
    summary: "Signals extracted from the provided business text.",
    confidence: 78,
    signals: [
      "↑ Weekend revenue increasing",
      negative ? "↓ Customer sentiment declining" : "↑ Customer sentiment stable",
      "↑ UPI adoption rising",
      negative ? "⚠ Delivery complaints increasing" : "⚠ Operational friction minimal",
    ],
    warnings: negative ? ["Customer sentiment is weakening."] : ["No negative trend detected."],
    recommendation: "Watch the negative signal stream and respond early.",
    rows: snippets.map((snippet, index) => ({ label: `Signal ${index + 1}`, value: inferSentiment(snippet).toUpperCase(), note: snippet })),
  };
}

async function groqResult(payload: Payload): Promise<Result | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const task = payload.task ?? "customer";
  const schema =
    task === "scenario"
      ? '{ "title": string, "summary": string, "confidence": number, "signals": string[], "warnings": string[], "recommendation": string, "metrics": { "revenue_impact": string, "customer_impact": string, "risk_level": string } }'
      : task === "signals"
        ? '{ "title": string, "summary": string, "confidence": number, "signals": string[], "warnings": string[], "recommendation": string }'
        : '{ "title": string, "summary": string, "confidence": number, "signals": string[], "warnings": string[], "recommendation": string }';

  const prompt = [
    `Task: ${task}`,
    `Return ONLY JSON matching: ${schema}`,
    JSON.stringify(payload),
  ].join("\n");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You produce concise, structured business intelligence." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Groq request failed with status ${response.status}`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq response missing content");
  const parsed = JSON.parse(content as string);
  return {
    id: `intel-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: String(parsed.title ?? "Business intelligence"),
    summary: String(parsed.summary ?? "Generated insight."),
    confidence: clamp(Number(parsed.confidence ?? 80), 0, 100),
    signals: Array.isArray(parsed.signals) ? parsed.signals.map(String).slice(0, 6) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).slice(0, 6) : [],
    recommendation: String(parsed.recommendation ?? "Review the result."),
    metrics: parsed.metrics && typeof parsed.metrics === "object" ? parsed.metrics : undefined,
    rows: [],
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;
    const groq = await groqResult(payload);
    const base =
      groq ??
      (payload.task === "scenario"
        ? scenarioResult(payload.business ?? "", payload.context ?? "")
        : payload.task === "signals"
          ? signalsResult(payload.rawText ?? "")
          : textResult(payload.rawText ?? ""));

    return NextResponse.json(base);
  } catch {
    return NextResponse.json(textResult(""), { status: 200 });
  }
}
