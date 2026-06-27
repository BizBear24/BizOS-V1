"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeIndianRupee,
  BarChart3,
  Brain,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  LineChart as LineIcon,
  PieChart as PieIcon,
  ShieldAlert,
  Sparkles,
  Upload,
  Users,
  Zap,
  MessageSquareMore,
  type LucideIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

const STORAGE_KEY = "bizos-workspace-v3";
const TEMPLATE_HEADERS = [
  "date",
  "type",
  "amount",
  "paymentMethod",
  "customer",
  "sentiment",
  "category",
  "note",
  "staffMember",
  "channel",
  "discount",
  "refund",
  "tags",
];
const NAV = [
  { id: "Overview", icon: BriefcaseBusiness },
  { id: "Analysis", icon: BarChart3 },
  { id: "Alerts", icon: AlertTriangle },
  { id: "Intelligence", icon: ShieldAlert },
  { id: "Customer Intelligence", icon: MessageSquareMore },
  { id: "Consultant", icon: Brain },
] as const;
const ANALYSIS_TABS = ["Payments", "Customers", "Growth"] as const;
const CONSULTANT_SCOPES = ["Overall", "Payments", "Customers", "Growth"] as const;
const red = "#ff2d2d";
const colors = ["#ff2d2d", "#f97316", "#22c55e", "#38bdf8", "#a78bfa"];

type NavId = (typeof NAV)[number]["id"];
type AnalysisTab = (typeof ANALYSIS_TABS)[number];
type ConsultantScope = (typeof CONSULTANT_SCOPES)[number];
type CustomerIntelTone = "positive" | "neutral" | "negative";
type EntryType = "sale" | "payment" | "feedback";
type PaymentMethod = "UPI" | "Cash" | "Card";
type Sentiment = "positive" | "neutral" | "negative";

type ActivityRow = {
  id: string;
  date: string;
  type: EntryType;
  amount: number;
  paymentMethod?: PaymentMethod;
  customer: string;
  sentiment: Sentiment;
  category: string;
  note: string;
};

type AnalysisRecord = {
  id: string;
  createdAt: string;
  scope: ConsultantScope;
  score: number;
  headline: string;
  summary: string;
  signals: string[];
  risks: string[];
  actions: string[];
  sourceCount: number;
  question: string;
};

type CustomerIntelRecord = {
  id: string;
  createdAt: string;
  overview: string;
  sentiment: CustomerIntelTone;
  churnRisk: "LOW" | "MEDIUM" | "HIGH";
  opportunity: string;
  recommendation: string;
  confidence: number;
  signals: string[];
  warnings: string[];
  relatedRows: number;
  feedbackSummary: Array<{
    customer: string;
    sentiment: Sentiment;
    category: string;
    note: string;
  }>;
};

const DEMO_ROWS: ActivityRow[] = [
  {
    id: "demo-1",
    date: "2026-06-24T09:30:00.000Z",
    type: "sale",
    amount: 1250,
    paymentMethod: "UPI",
    customer: "Ananya",
    sentiment: "positive",
    category: "Dine-in",
    note: "Lunch table 4 with quick service",
  },
  {
    id: "demo-2",
    date: "2026-06-24T11:15:00.000Z",
    type: "payment",
    amount: 650,
    paymentMethod: "Cash",
    customer: "Rahul",
    sentiment: "neutral",
    category: "Checkout",
    note: "Counter payment processed smoothly",
  },
  {
    id: "demo-3",
    date: "2026-06-25T17:20:00.000Z",
    type: "feedback",
    amount: 0,
    customer: "Meera",
    sentiment: "negative",
    category: "Service",
    note: "Checkout was slow and staff were busy",
  },
  {
    id: "demo-4",
    date: "2026-06-26T20:05:00.000Z",
    type: "sale",
    amount: 1800,
    paymentMethod: "Card",
    customer: "Ananya",
    sentiment: "positive",
    category: "Dinner",
    note: "Family dinner with dessert",
  },
  {
    id: "demo-5",
    date: "2026-06-26T20:35:00.000Z",
    type: "sale",
    amount: 980,
    paymentMethod: "UPI",
    customer: "Kabir",
    sentiment: "positive",
    category: "Takeaway",
    note: "Quick takeaway order",
  },
  {
    id: "demo-6",
    date: "2026-06-25T21:10:00.000Z",
    type: "feedback",
    amount: 0,
    customer: "Nina",
    sentiment: "positive",
    category: "Product",
    note: "Food quality was excellent and timely",
  },
];

const DEMO_ANALYSIS: AnalysisRecord[] = [
  {
    id: "demo-analysis-1",
    createdAt: "2026-06-26T18:15:00.000Z",
    scope: "Overall",
    score: 78,
    headline: "Business consultant brief",
    summary: "The demo workspace reads like a healthy small business with one service bottleneck and a strong UPI-led payment profile.",
    signals: [
      "6 rows of live activity are available in the demo dataset.",
      "UPI is the strongest payment rail.",
      "Positive feedback outnumbers negative notes.",
    ],
    risks: ["Service speed needs attention.", "Feedback volume is still modest."],
    actions: ["Use the last customer note to guide the next shift.", "Keep logging rows so the model stays fresh."],
    sourceCount: 6,
    question: "What should the consultant pay attention to?",
  },
];

type Workspace = {
  fileName: string;
  importedAt: string;
  rows: ActivityRow[];
  analyses: AnalysisRecord[];
};

type ViewModel = {
  healthScore: number;
  threatLevel: string;
  totalRevenue: number;
  activityCount: number;
  sentimentSplit: Array<{ name: string; value: number }>;
  paymentMix: Array<{ name: string; value: number }>;
  categoryMix: Array<{ name: string; value: number }>;
  trend: Array<{ name: string; revenue: number; count: number }>;
  hourHeatmap: Array<{ name: string; count: number }>;
  repeatCustomers: number;
  latestRows: ActivityRow[];
  latestAnalyses: AnalysisRecord[];
  latestFeedback: ActivityRow[];
  summaryLines: string[];
  insights: string[];
  warnings: string[];
  alertItems: Array<{
    title: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    detail: string;
    source: string;
  }>;
  actions: string[];
};

function emptyWorkspace(): Workspace {
  return { fileName: "", importedAt: "", rows: [], analyses: [] };
}

function loadWorkspace(): Workspace {
  if (typeof window === "undefined") return emptyWorkspace();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyWorkspace();
    const parsed = JSON.parse(raw) as Partial<Workspace>;
    return {
      fileName: parsed.fileName || "",
      importedAt: parsed.importedAt || "",
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
      analyses: Array.isArray(parsed.analyses) ? parsed.analyses : [],
    };
  } catch {
    return emptyWorkspace();
  }
}

function saveFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(value));
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanText(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

function parseAmount(value: unknown) {
  const raw = cleanText(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setDate(excelEpoch.getDate() + value);
    return excelEpoch.toISOString();
  }
  const parsed = new Date(cleanText(value));
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

function inferSentiment(note: string, explicit?: string): Sentiment {
  const normalized = cleanText(explicit).toLowerCase();
  if (/(^|[^a-z])(positive|pos|good|great|happy|love|liked|satisfied)([^a-z]|$)/.test(normalized)) return "positive";
  if (/(^|[^a-z])(negative|neg|bad|poor|unhappy|disappointed|dissatisfied)([^a-z]|$)/.test(normalized)) return "negative";

  const lower = note.toLowerCase();

  const positiveHits = [
    /(^|[^a-z])(great|excellent|amazing|awesome|happy|love|loved|liked|satisfied|smooth|quick|fast|helpful|perfect)([^a-z]|$)/g,
  ].reduce((count, pattern) => count + (lower.match(pattern)?.length ?? 0), 0);

  const negativeHits = [
    /(^|[^a-z])(slow|late|bad|poor|badly|terrible|awful|hate|hated|unhappy|disappointed|dissatisfied|issue|problem|complaint|worst|delay|refund|confusing|rude)([^a-z]|$)/g,
    /\b(not|never|no|didn't|dont|don't|cannot|can't|won't|wont|without)\b\s+(like|liked|love|loved|want|wanted|recommend|satisfied|happy|good|great|helpful|okay|ok)\b/g,
    /\b(did not|didn't|do not|don't|wasn't|were not|not)\b.*\b(like|love|enjoy|satisfied|happy|good|great|helpful)\b/g,
  ].reduce((count, pattern) => count + (lower.match(pattern)?.length ?? 0), 0);

  if (negativeHits > positiveHits) return "negative";
  if (positiveHits > negativeHits) return "positive";

  if (/\bnot bad\b/.test(lower) || /\bokay\b/.test(lower) || /\bokay\b/.test(lower)) return "neutral";
  if (positiveHits > 0) return "positive";
  if (negativeHits > 0) return "negative";
  return "neutral";
}

function inferType(row: Record<string, unknown>): EntryType {
  const raw = cleanText(row.type ?? row.transactiontype ?? row.event ?? row.activity).toLowerCase();
  if (raw === "payment") return "payment";
  if (raw === "feedback") return "feedback";
  return "sale";
}

function asPaymentMethod(value: unknown): PaymentMethod | undefined {
  const raw = cleanText(value).toLowerCase();
  if (raw === "upi") return "UPI";
  if (raw === "cash") return "Cash";
  if (raw === "card" || raw === "debitcard" || raw === "creditcard") return "Card";
  return undefined;
}

function getAlias(row: Record<string, unknown>, aliases: string[]) {
  const indexed = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
  for (const alias of aliases) {
    const hit = indexed[normalizeKey(alias)];
    if (hit !== undefined && hit !== null && cleanText(hit) !== "") return hit;
  }
  return undefined;
}

function normalizeImportedRows(records: Array<Record<string, unknown>>): ActivityRow[] {
  return records
    .map((record) => {
      const type = inferType(record);
      const note =
        cleanText(getAlias(record, ["note", "feedback", "comment", "remarks", "description", "context", "detail", "summary"])) ||
        "Imported activity";
      const customer = cleanText(getAlias(record, ["customer", "customer name", "client", "guest"])) || "Unknown";
      const sentiment = inferSentiment(note, cleanText(getAlias(record, ["sentiment", "tone", "mood"])));
      const category =
        cleanText(getAlias(record, ["category", "segment", "product", "service", "item", "topic", "group"])) ||
        (type === "payment" ? "Payments" : type === "feedback" ? "Feedback" : "Sales");
      const tags = cleanText(getAlias(record, ["tags", "tag", "labels", "keywords"]));
      return {
        id: createId("row"),
        date: parseDateValue(getAlias(record, ["date", "datetime", "timestamp", "time"])),
        type,
        amount: parseAmount(getAlias(record, ["amount", "value", "revenue", "sale amount", "saleamount"])),
        paymentMethod: asPaymentMethod(getAlias(record, ["paymentmethod", "method", "payment mode", "paymentmode"])),
        customer,
        sentiment,
        category,
        note: tags ? `${note} | Tags: ${tags}` : note,
      };
    })
    .filter((row) => row.note !== "Imported activity" || row.amount > 0 || row.customer !== "Unknown");
}

function buildView(rows: ActivityRow[], analyses: AnalysisRecord[]): ViewModel {
  const sortedRows = [...rows].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const sales = rows.filter((row) => row.type === "sale");
  const feedback = rows.filter((row) => row.type === "feedback");
  const payments = rows.filter((row) => row.type === "payment" || row.paymentMethod);
  const revenue = sales.reduce((sum, row) => sum + row.amount, 0);
  const positive = rows.filter((row) => row.sentiment === "positive").length;
  const negative = rows.filter((row) => row.sentiment === "negative").length;
  const customerSet = new Set(rows.map((row) => row.customer).filter((name) => name && name !== "Unknown"));
  const hourBuckets = ["Morning", "Midday", "Afternoon", "Evening", "Late"].map((name) => ({ name, count: 0 }));

  rows.forEach((row) => {
    const hour = new Date(row.date).getHours();
    const bucket = hour < 11 ? "Morning" : hour < 14 ? "Midday" : hour < 18 ? "Afternoon" : hour < 21 ? "Evening" : "Late";
    const target = hourBuckets.find((item) => item.name === bucket);
    if (target) target.count += 1;
  });

  const trendMap = new Map<string, { revenue: number; count: number }>();
  rows.forEach((row) => {
    const key = dayLabel(row.date);
    const entry = trendMap.get(key) ?? { revenue: 0, count: 0 };
    entry.count += 1;
    if (row.type === "sale") entry.revenue += row.amount;
    trendMap.set(key, entry);
  });

  const trend = [...trendMap.entries()]
    .slice(-6)
    .map(([name, value]) => ({ name, ...value }));

  const paymentMix = [
    { name: "UPI", value: 0 },
    { name: "Cash", value: 0 },
    { name: "Card", value: 0 },
  ];
  payments.forEach((row) => {
    if (row.paymentMethod) {
      const hit = paymentMix.find((item) => item.name === row.paymentMethod);
      if (hit) hit.value += row.amount || 1;
    }
  });

  const topicMix = [
    { name: "Service", value: 0 },
    { name: "Pricing", value: 0 },
    { name: "Delivery", value: 0 },
    { name: "Product", value: 0 },
  ];
  feedback.forEach((row) => {
    const text = `${row.note} ${row.category}`.toLowerCase();
    if (/service|staff|support|response|wait/.test(text)) topicMix[0].value += 1;
    if (/price|cost|expensive|discount|value/.test(text)) topicMix[1].value += 1;
    if (/delivery|late|delay|shipping|dispatch/.test(text)) topicMix[2].value += 1;
    if (/product|quality|taste|item|menu|stock/.test(text)) topicMix[3].value += 1;
  });

  const sentimentSplit = [
    { name: "Positive", value: positive },
    { name: "Neutral", value: rows.filter((row) => row.sentiment === "neutral").length },
    { name: "Negative", value: negative },
  ];

  const healthScore = Math.round(
    clamp(
      55 +
        Math.min(20, revenue / 100000) +
        Math.min(12, rows.length * 1.5) +
        positive * 2 -
        negative * 4 +
        Math.min(6, analyses.length * 2),
      10,
      98,
    ),
  );

  const weekendRevenue = sales
    .filter((row) => {
      const day = new Date(row.date).getDay();
      return day === 0 || day === 6;
    })
    .reduce((sum, row) => sum + row.amount, 0);

  const weekdayRevenue = sales
    .filter((row) => {
      const day = new Date(row.date).getDay();
      return day >= 1 && day <= 5;
    })
    .reduce((sum, row) => sum + row.amount, 0);

  const paymentLeading = paymentMix.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), paymentMix[0]);
  const negativeFeedback = feedback
    .filter((row) => row.sentiment === "negative")
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const consultantAlerts = analyses.flatMap((analysis) =>
    analysis.risks.slice(0, 3).map((risk) => ({
      title: analysis.headline,
      severity: /churn|negative|risk|retention|critical/i.test(risk) ? ("HIGH" as const) : ("MEDIUM" as const),
      detail: risk,
      source: `AI consultant · ${shortDate(analysis.createdAt)}`,
    })),
  );
  const businessAlerts = [
    ...(paymentLeading.value > revenue * 0.65
      ? [
          {
            title: "Payment concentration",
            severity: "MEDIUM" as const,
            detail: `${paymentLeading.name} dominates the payment mix.`,
            source: "Business analysis",
          },
        ]
      : []),
    ...(rows.length < 12
      ? [
          {
            title: "Thin signal base",
            severity: "LOW" as const,
            detail: "Trend confidence is lower because the dataset is still small.",
            source: "Business analysis",
          },
        ]
      : []),
  ];
  const categoryMix = Object.entries(
    rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.category || "Uncategorized";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const repeatCustomers = [...customerSet].filter((name) => rows.filter((row) => row.customer === name).length > 1).length;
  const summaryLines =
    rows.length === 0
      ? [
          "No file has been uploaded yet, so the demo workspace is showing sample data.",
          "Upload a clean Excel file to replace the demo rows.",
          "The consultant and charts update automatically from the imported worksheet.",
        ]
      : [
          `${rows.length} activity rows are live in the workspace.`,
          revenue > 0 ? `${currency(revenue)} in revenue is derived from logged sales.` : "Revenue is waiting on sale rows in the file.",
          paymentLeading.value > 0 ? `${paymentLeading.name} is the strongest payment rail.` : "No payment mix was found in the uploaded file.",
          `${hourBuckets.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), hourBuckets[0]).name} is the busiest activity window.`,
        ];

  return {
    healthScore,
    threatLevel: rows.length === 0 ? "Awaiting file" : healthScore >= 80 ? "Low" : healthScore >= 65 ? "Medium" : "High",
    totalRevenue: revenue,
    activityCount: rows.length,
    sentimentSplit,
    paymentMix,
    categoryMix,
    trend,
    hourHeatmap: hourBuckets,
    repeatCustomers,
    latestRows: sortedRows.slice(0, 7),
    latestAnalyses: analyses.slice(0, 5),
    latestFeedback: feedback.slice().sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 6),
    summaryLines,
    insights: [
      paymentLeading.value > 0 ? `${paymentLeading.name} dominates payments.` : "No payment data yet.",
      weekendRevenue > weekdayRevenue ? "Weekend revenue is stronger than weekdays." : "Weekday revenue leads the file.",
      repeatCustomers > 0 ? `${repeatCustomers} customers appear more than once.` : "No repeated customers are visible yet.",
    ],
    warnings: [
      negative > 0 ? `${negative} negative feedback entries are present.` : "No negative sentiment is present yet.",
      paymentLeading.value > revenue * 0.65 ? "Payment concentration is high." : "Payment mix is reasonably spread.",
      rows.length < 12 ? "Upload more rows for stronger trend confidence." : "Trend coverage is adequate.",
      negative > 1 ? "Churn pressure is rising from repeated negative feedback." : "No churn cluster is visible yet.",
    ],
    alertItems: [
      ...negativeFeedback.slice(0, 4).map((row) => ({
        title: row.category || "Negative feedback",
        severity: "HIGH" as const,
        detail: row.note,
        source: `Customer feedback · ${row.customer} · ${shortDate(row.date)}`,
      })),
      ...consultantAlerts,
      ...businessAlerts,
    ],
    actions: [
      "Review the latest feedback notes before the next shift.",
      "Use the payment mix to shape checkout nudges.",
      "Turn repeat customers into a loyalty list.",
    ],
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildConsultantAnalysis(rows: ActivityRow[], scope: ConsultantScope, question: string): AnalysisRecord {
  const view = buildView(rows, []);
  const paymentLead = view.paymentMix.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), view.paymentMix[0]);
  const sentimentLead = view.sentimentSplit.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), view.sentimentSplit[0]);
  const baseScore = view.healthScore + (scope === "Overall" ? 2 : 0) + (question.trim() ? 1 : 0);
  const score = Math.round(clamp(baseScore, 12, 98));

  const presets: Record<
    ConsultantScope,
    {
      headline: string;
      summary: string;
      signals: string[];
      risks: string[];
      actions: string[];
    }
  > = {
    Overall: {
      headline: "Business consultant brief",
      summary: `The file reads at ${score}/100. The strongest signal is ${sentimentLead.name.toLowerCase()} sentiment with ${view.activityCount} live rows.`,
      signals: [
        `${view.activityCount} rows imported from the file.`,
        `${currency(view.totalRevenue)} total revenue from sale rows.`,
        `${paymentLead.name} is the leading payment method.`,
      ],
      risks: view.warnings,
      actions: view.actions,
    },
    Payments: {
      headline: "Payment intelligence",
      summary: `${paymentLead.name} is carrying the payment mix and the payment profile looks ${score >= 75 ? "healthy" : "concentrated"}.`,
      signals: [
        `${paymentLead.name} leads the payment mix.`,
        `${view.hourHeatmap.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), view.hourHeatmap[0]).name} is the busiest window.`,
        `${currency(view.totalRevenue)} revenue is tied to logged sales.`,
      ],
      risks: ["Payment concentration could be a dependency.", "Low payment mix variety reduces flexibility."],
      actions: ["Nudge alternate rails when checkout allows it.", "Watch peak hours for staffing and cash flow."],
    },
    Customers: {
      headline: "Customer intelligence",
      summary: `Customer sentiment is currently ${sentimentLead.name.toLowerCase()} and repeat customers are visible in the file.`,
      signals: [
        `${view.sentimentSplit.find((item) => item.name === "Positive")?.value || 0} positive entries.`,
        `${view.sentimentSplit.find((item) => item.name === "Negative")?.value || 0} negative entries.`,
        `${view.repeatCustomers} repeat customers detected.`,
      ],
      risks: ["A wave of negative feedback can weaken retention.", "Thin feedback volume reduces confidence."],
      actions: ["Read the latest notes before replying.", "Convert positive feedback into loyalty touchpoints."],
    },
    Growth: {
      headline: "Growth planning",
      summary: `The trend line has ${view.trend.length} visible points and ${currency(view.totalRevenue)} in observed revenue.`,
      signals: [
        `${view.trend.length} trend points are visible.`,
        `${view.categoryMix[0]?.name || "No"} is the top category.`,
        `${view.totalRevenue > 0 ? currency(view.totalRevenue) : "No"} revenue recorded.`,
      ],
      risks: ["Small files can create noisy trend reads.", "Category concentration may limit expansion."],
      actions: ["Track one more week before making a growth call.", "Use the top category as the next upsell angle."],
    },
  };

  const preset = presets[scope];
  return {
    id: createId("analysis"),
    createdAt: new Date().toISOString(),
    scope,
    score,
    headline: preset.headline,
    summary: question.trim() ? `${preset.summary} Client question: ${question.trim()}` : preset.summary,
    signals: preset.signals,
    risks: preset.risks,
    actions: preset.actions,
    sourceCount: rows.length,
    question: question.trim() || "No client question supplied.",
  };
}

function formatUploadDate(value: string) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "No file yet";
}

function buildCustomerIntelPayload(view: ViewModel, rawText: string) {
  return {
    context: "Customer intelligence text input",
    rawText,
    healthScore: view.healthScore,
    threatLevel: view.threatLevel,
    totalRevenue: view.totalRevenue,
    activityCount: view.activityCount,
    sentimentSplit: view.sentimentSplit,
    repeatCustomers: view.repeatCustomers,
    warnings: view.warnings,
    actions: view.actions,
  };
}

export default function Home() {
  const [active, setActive] = useState<NavId>("Overview");
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("Payments");
  const [consultantScope, setConsultantScope] = useState<ConsultantScope>("Overall");
  const [workspace, setWorkspace] = useState<Workspace>(() => emptyWorkspace());
  const [notice, setNotice] = useState("Upload an Excel file to begin.");
  const [consultantContext, setConsultantContext] = useState({
    ownerGoal: "Increase repeat orders without adding overhead",
    recentChange: "Weekend traffic is stronger than weekdays",
    decision: "Where to focus the next operational improvement",
  });
  const [customerIntelText, setCustomerIntelText] = useState(
    "Customer said: I did not like the slow checkout. Support was helpful, but overall the experience felt frustrating.",
  );
  const [customerIntel, setCustomerIntel] = useState<CustomerIntelRecord | null>(null);
  const [customerIntelLoading, setCustomerIntelLoading] = useState(false);
  const [customerIntelError, setCustomerIntelError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const stored = loadWorkspace();
    if (stored.fileName || stored.rows.length || stored.analyses.length) {
      setWorkspace(stored);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace, hydrated]);

  const view = useMemo(() => buildView(workspace.rows, workspace.analyses), [workspace.rows, workspace.analyses]);

  const handleFiles = async (file: File) => {
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let imported: ActivityRow[] = [];
      if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        imported = normalizeImportedRows(json);
      } else {
        setNotice("Use a .xlsx or .xls file.");
        return;
      }

      setWorkspace((current) => ({
        ...current,
        fileName: file.name,
        importedAt: new Date().toISOString(),
        rows: imported,
      }));
      setNotice(`Imported ${imported.length} rows from ${file.name}.`);
      setActive("Overview");
    } catch {
      setNotice("That file could not be read. Try the Excel template export.");
    }
  };

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Activity Template");
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    downloadBlob(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "bizos_activity_template.xlsx");
  };

  const generateAnalysis = () => {
    if (workspace.rows.length === 0) {
      setNotice("Upload data first, then generate an analysis.");
      return;
    }
    const question = [
      `Goal: ${consultantContext.ownerGoal}`,
      `Recent change: ${consultantContext.recentChange}`,
      `Decision: ${consultantContext.decision}`,
    ].join(" | ");
    const analysis = buildConsultantAnalysis(workspace.rows, consultantScope, question);
    setWorkspace((current) => ({
      ...current,
      analyses: [analysis, ...current.analyses],
    }));
    setNotice(`Saved a ${consultantScope.toLowerCase()} analysis.`);
    setActive("Consultant");
  };

  const generateCustomerIntel = async () => {
    if (workspace.rows.length === 0) {
      setNotice("Upload data first, then generate customer intelligence.");
      return;
    }
    setCustomerIntelLoading(true);
    setCustomerIntelError("");
    try {
      const response = await fetch("/api/customer-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCustomerIntelPayload(view, customerIntelText)),
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const result = (await response.json()) as CustomerIntelRecord;
      setCustomerIntel(result);
      setWorkspace((current) => ({
        ...current,
        analyses: [
          {
            id: createId("analysis"),
            createdAt: result.createdAt,
            scope: "Customers",
            score: result.sentiment === "negative" ? 42 : result.sentiment === "neutral" ? 68 : 82,
            headline: "Customer intelligence brief",
            summary: result.overview,
            signals: result.signals,
            risks: result.warnings,
            actions: [result.recommendation],
            sourceCount: result.relatedRows,
            question: customerIntelText,
          },
          ...current.analyses,
        ],
      }));
      setNotice("Customer intelligence refreshed.");
      setActive("Customer Intelligence");
    } catch (error) {
      setCustomerIntelError(error instanceof Error ? error.message : "Unable to generate customer intelligence.");
    } finally {
      setCustomerIntelLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden p-3 text-white md:p-5">
      <div className="mx-auto grid max-w-[1480px] gap-4 lg:grid-cols-[245px_1fr]">
        <aside className="glass h-fit min-w-0 rounded-lg p-3 lg:sticky lg:top-4 lg:p-4">
          <div className="mb-4 lg:mb-8">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-[#ff2d2d] shadow-[0_0_30px_rgba(255,45,45,.28)]">
                <BriefcaseBusiness size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">BizOS</h1>
                <p className="text-xs text-zinc-400">Business intelligence OS</p>
              </div>
            </div>
          </div>
          <nav className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`flex min-w-fit items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition lg:min-w-0 ${
                    active === item.id ? "bg-[#ff2d2d] text-white shadow-[0_12px_32px_rgba(255,45,45,.24)]" : "text-zinc-300 hover:bg-white/8"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} />
                    {item.id}
                  </span>
                  {active === item.id && <ChevronRight size={16} />}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="glass mb-4 flex flex-col gap-4 rounded-lg p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#ff5c5c]">Minimal, file-driven, judge-friendly</p>
              <h2 className="text-2xl font-extrabold tracking-tight md:text-4xl">{active}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
                {workspace.fileName ? saveFileName(workspace.fileName) : "Demo workspace"}
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg bg-[#ff2d2d] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#ff4444]"
              >
                <Upload size={16} />
                Upload XLSX
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFiles(file);
                  event.currentTarget.value = "";
                }}
              />
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${active}-${analysisTab}-${consultantScope}-${workspace.rows.length}-${workspace.analyses.length}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {active === "Overview" && <Overview view={view} workspace={workspace} notice={notice} />}
              {active === "Analysis" && <Analysis view={view} analysisTab={analysisTab} setAnalysisTab={setAnalysisTab} />}
              {active === "Alerts" && <Alerts view={view} />}
              {active === "Intelligence" && <Intelligence view={view} />}
              {active === "Customer Intelligence" && (
                <CustomerIntelligence
                  view={view}
                  workspace={workspace}
                  note={customerIntelText}
                  setNote={setCustomerIntelText}
                  result={customerIntel}
                  loading={customerIntelLoading}
                  error={customerIntelError}
                  onGenerate={generateCustomerIntel}
                />
              )}
              {active === "Consultant" && (
                <Consultant
                  view={view}
                  workspace={workspace}
                  consultantScope={consultantScope}
                  setConsultantScope={setConsultantScope}
                  consultantContext={consultantContext}
                  setConsultantContext={setConsultantContext}
                  onGenerate={generateAnalysis}
                  onTemplateDownload={downloadTemplate}
                  notice={notice}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}

function Overview({ view, workspace, notice }: { view: ViewModel; workspace: Workspace; notice: string }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="glass rounded-lg p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Health</p>
          <div className="mt-3 flex items-end gap-3">
            <motion.span initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-7xl font-extrabold md:text-8xl">
              {view.healthScore}
            </motion.span>
            <span className="pb-3 text-2xl text-zinc-500">/100</span>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Metric icon={ArrowUpRight} label="Revenue" value={currency(view.totalRevenue)} detail="from uploaded sale rows" />
            <Metric icon={Users} label="Imported Rows" value={`${view.activityCount}`} detail="activity rows in file" />
            <Metric icon={BadgeIndianRupee} label="Threat" value={view.threatLevel} detail="current operating read" />
          </div>
        </div>
        <div className="card rounded-lg p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
            <Sparkles size={17} className="text-[#ff2d2d]" />
            Current Read
          </p>
          <div className="grid gap-3">
            <SmallStat label="File" value={workspace.fileName || "Demo workspace"} />
            <SmallStat label="Imported" value={workspace.importedAt ? formatUploadDate(workspace.importedAt) : "Ready"} />
            <SmallStat label="Analysis trail" value={`${workspace.analyses.length} saved runs`} />
          </div>
          <div className="mt-5 grid gap-2 text-sm leading-6 text-zinc-300">
            {view.summaryLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="glass rounded-lg p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
            <FileSpreadsheet size={18} className="text-[#ff2d2d]" />
            Live Rows
          </p>
          <div className="grid gap-3">
            {view.latestRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-zinc-400">No rows imported yet.</div>
            ) : (
              view.latestRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold capitalize">{row.type}</span>
                    <span className="text-xs text-zinc-500">{shortDate(row.date)}</span>
                  </div>
                  <p className="mt-2 text-zinc-300">{row.note}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span>{row.customer}</span>
                    <span>{row.category}</span>
                    <span>{currency(row.amount)}</span>
                    {row.paymentMethod ? <span>{row.paymentMethod}</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="glass rounded-lg p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
            <Brain size={18} className="text-[#ff2d2d]" />
            What the Consultant Sees
          </p>
          <div className="grid gap-3">
            {view.latestAnalyses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-zinc-400">No analysis has been saved yet.</div>
            ) : (
              view.latestAnalyses.map((analysis) => (
                <div key={analysis.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{analysis.headline}</span>
                    <span className="text-xs text-zinc-500">{shortDate(analysis.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-zinc-300">{analysis.summary}</p>
                  <p className="mt-3 text-xs text-zinc-400">
                    Scope: {analysis.scope} · Score: {analysis.score}/100 · From {analysis.sourceCount} rows
                  </p>
                </div>
              ))
            )}
          </div>
          <p className="mt-5 text-sm text-zinc-400">{notice}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <InsightsBox title="Quick Tips" icon={Sparkles} items={view.insights} />
        <InsightsBox title="Warnings" icon={ShieldAlert} items={view.warnings} />
        <InsightsBox
          title="Next Moves"
          icon={Zap}
          items={[
            "Add more rows to sharpen the trend line.",
            "Use the consultant to compare payment and customer signals.",
            "Replace demo data with an Excel upload when you are ready.",
          ]}
        />
      </div>
    </div>
  );
}

function Analysis({
  view,
  analysisTab,
  setAnalysisTab,
}: {
  view: ViewModel;
  analysisTab: AnalysisTab;
  setAnalysisTab: Dispatch<SetStateAction<AnalysisTab>>;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {ANALYSIS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setAnalysisTab(tab)}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              analysisTab === tab ? "border-[#ff2d2d] bg-[#ff2d2d] text-white" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {analysisTab === "Payments" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Payment Mix" icon={PieIcon}>
            <PieChart>
              <Pie data={view.paymentMix} dataKey="value" nameKey="name" outerRadius={104} innerRadius={56} paddingAngle={3}>
                {view.paymentMix.map((_, index) => (
                  <Cell key={index} fill={colors[index]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ChartCard>
          <ChartCard title="Peak Hours" icon={BarChart3}>
            <BarChart data={view.hourHeatmap}>
              <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={red} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
          <InsightsBox title="Payment Analysis" icon={BadgeIndianRupee} items={view.insights} />
          <InsightsBox
            title="Payment Notes"
            icon={AlertTriangle}
            items={[
              "Payment concentration can create checkout dependency.",
              "Peak-hour staffing should match the busiest bucket.",
              "Use the template file to keep every payment row structured.",
            ]}
          />
        </div>
      )}

      {analysisTab === "Customers" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Sentiment" icon={Users}>
            <BarChart data={view.sentimentSplit}>
              <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill={red} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title="Complaint Themes" icon={AlertTriangle}>
            <BarChart data={view.categoryMix}>
              <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill={red} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
          <InsightsBox title="Customer Analysis" icon={Users} items={view.insights} />
          <InsightsBox
            title="Customer Notes"
            icon={ShieldAlert}
            items={[
              "Negative sentiment should be reviewed before the next response.",
              "Low feedback volume reduces confidence.",
              "Repeated customers are usually the easiest growth win.",
            ]}
          />
        </div>
      )}

      {analysisTab === "Growth" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Revenue Trend" icon={LineIcon}>
            <AreaChart data={view.trend}>
              <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="revenue" stroke={red} fill="rgba(255,45,45,.18)" strokeWidth={3} />
            </AreaChart>
          </ChartCard>
          <ChartCard title="Activity Count" icon={BarChart3}>
            <BarChart data={view.trend}>
              <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={red} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
          <InsightsBox title="Growth Analysis" icon={ArrowUpRight} items={view.summaryLines} />
          <InsightsBox
            title="Growth Opportunities"
            icon={Zap}
            items={[
              "Use the strongest category as the next upsell angle.",
              "Build around the trend line before adding more complexity.",
              "Keep each file import clean so the charts stay trustworthy.",
            ]}
          />
        </div>
      )}

    </div>
  );
}

function Intelligence({ view }: { view: ViewModel }) {
  const executive = [
    ["Status", view.healthScore >= 80 ? "STABLE" : "WARNING"],
    ["Primary Threat", "Customer retention"],
    ["Primary Opportunity", "Corporate customers"],
    ["Recommended Action", "Launch loyalty program"],
  ];
  const riskRadar = [
    ["Customer Churn", view.warnings.some((item) => item.toLowerCase().includes("churn") || item.toLowerCase().includes("negative")) ? "HIGH" : "MEDIUM"],
    ["Revenue Stability", view.totalRevenue > 0 && view.warnings.some((item) => item.toLowerCase().includes("revenue")) ? "MEDIUM" : "LOW"],
    ["Competition", "LOW"],
    ["Seasonality", view.summaryLines.some((item) => item.toLowerCase().includes("weekend")) ? "MEDIUM" : "LOW"],
  ];
  const opportunityRadar = [
    ["Highest Opportunity", "Corporate Orders"],
    ["Secondary", "Subscription Model"],
    ["Emerging", "Loyalty Program"],
  ];
  const businessSignals = [
    view.paymentMix[0]?.value > 0 ? "↑ UPI adoption rising" : "↑ Payment activity building",
    view.sentimentSplit[0]?.value >= view.sentimentSplit[2]?.value ? "↑ Customer sentiment stabilizing" : "↓ Customer sentiment declining",
    view.summaryLines.some((item) => item.toLowerCase().includes("weekend")) ? "↑ Weekend revenue increasing" : "↑ Weekday revenue increasing",
    view.warnings.some((item) => item.toLowerCase().includes("delivery")) ? "⚠ Delivery complaints increasing" : "⚠ Service friction needs attention",
  ];
  const confidence = [
    ["Business Health", `${view.healthScore}%`],
    ["Recommendation Confidence", `${Math.min(96, Math.max(72, view.healthScore + 6))}%`],
    ["Risk Confidence", `${Math.min(94, Math.max(68, view.healthScore + 3))}%`],
  ];

  return (
    <div className="grid gap-4">
      <div className="glass rounded-lg p-6">
        <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
          <Brain size={18} className="text-[#ff2d2d]" />
          Executive Brief
        </p>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-lg border border-[#ff2d2d]/30 bg-[#ff2d2d]/10 p-5">
            <p className="text-sm text-zinc-400">Status</p>
            <p className="mt-1 text-4xl font-extrabold">{view.healthScore >= 80 ? "STABLE" : "WARNING"}</p>
            <div className="mt-5 grid gap-3 text-sm text-zinc-200">
              {executive.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                  <span className="text-zinc-400">{label}</span>
                  <span className="text-right font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <SmallStat label="Primary Threat" value="Customer retention" />
            <SmallStat label="Primary Opportunity" value="Corporate customers" />
            <SmallStat label="Recommended Action" value="Launch loyalty program" />
            <SmallStat label="LLM Generated" value="Yes" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <InsightsBox
          title="Risk Radar"
          icon={ShieldAlert}
          items={riskRadar.map(([label, value]) => `${label}: ${value}`)}
        />
        <InsightsBox
          title="Opportunity Radar"
          icon={Zap}
          items={opportunityRadar.map(([label, value]) => `${label}: ${value}`)}
        />
        <InsightsBox title="Business Signals" icon={ArrowUpRight} items={businessSignals} />
        <InsightsBox
          title="AI Confidence"
          icon={CheckCircle2}
          items={confidence.map(([label, value]) => `${label}: ${value}`)}
        />
      </div>
    </div>
  );
}

function CustomerIntelligence({
  view,
  workspace,
  note,
  setNote,
  result,
  loading,
  error,
  onGenerate,
}: {
  view: ViewModel;
  workspace: Workspace;
  note: string;
  setNote: Dispatch<SetStateAction<string>>;
  result: CustomerIntelRecord | null;
  loading: boolean;
  error: string;
  onGenerate: () => void;
}) {
  const latest = result?.feedbackSummary ?? [];

  return (
    <div className="grid gap-4">
      <div className="glass rounded-lg p-6">
        <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
          <MessageSquareMore size={18} className="text-[#ff2d2d]" />
          Customer Intelligence
        </p>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <div className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Raw Text</p>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-28 rounded-lg border border-white/10 bg-black/35 p-3 text-white outline-none focus:border-[#ff2d2d]"
              placeholder="Paste a WhatsApp export, review text, notes, or PDF text here."
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onGenerate}
                disabled={loading || note.trim().length === 0}
                className="flex items-center gap-2 rounded-lg bg-[#ff2d2d] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#ff4444] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={16} />
                {loading ? "Analyzing..." : "Run Customer Intelligence"}
              </button>
              <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-300">
                Text length: {note.trim().length}
              </span>
            </div>
            <p className="text-sm text-zinc-400">
              This tab reads raw pasted text and turns it into sentiment, churn risk, opportunity, and action guidance.
            </p>
            {error ? <p className="rounded-lg border border-[#ff2d2d]/25 bg-[#ff2d2d]/10 p-3 text-sm text-[#ffb3b3]">{error}</p> : null}
          </div>

          <div className="grid gap-3">
            <SmallStat label="Customer Sentiment" value={result ? result.sentiment.toUpperCase() : "PENDING"} />
            <SmallStat label="Churn Risk" value={result ? result.churnRisk : "PENDING"} />
            <SmallStat label="Opportunity" value={result?.opportunity || "Pending analysis"} />
            <SmallStat label="Confidence" value={result ? `${result.confidence}%` : "PENDING"} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <InsightsBox
          title="Executive Read"
          icon={Brain}
          items={[
            result?.overview || "The customer base looks usable, but the best signal comes from the written feedback and not just the counts.",
            `Primary recommendation: ${result?.recommendation || "Turn repeat customers into a loyalty loop."}`,
            `Active context: ${note}`,
          ]}
        />
        <InsightsBox
          title="Risk and Opportunity"
          icon={ShieldAlert}
          items={[
            `Churn risk: ${result?.churnRisk || "PENDING"}`,
            `Warnings: ${(result?.warnings.length || view.warnings.length) > 0 ? "Present" : "None"}`,
            `Opportunity: ${result?.opportunity || "Subscription or loyalty expansion"}`,
          ]}
        />
        <InsightsBox
          title="Feedback Signals"
          icon={Users}
          items={
            latest.length > 0
              ? latest.map((item) => `${item.customer}: ${item.sentiment} | ${item.category} | ${item.note}`)
              : ["Paste raw customer text to see extracted snippets here."]
          }
        />
        <InsightsBox
          title="Action Notes"
          icon={Zap}
          items={
            result?.signals?.length
              ? result.signals
              : [
                  "Paste the raw text directly into this box.",
                  "Use sentiment to track retention pressure over time.",
                  "Connect negative notes to the Alerts tab for fast review.",
                ]
          }
        />
      </div>
      <div className="glass rounded-lg p-6">
        <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
          <BriefcaseBusiness size={18} className="text-[#ff2d2d]" />
          Analytics Export
        </p>
        <p className="text-sm text-zinc-300">
          Every run is written into the analysis trail, so customer sentiment shows up alongside the rest of the business intelligence.
        </p>
        <p className="mt-3 text-sm text-zinc-500">
          Latest saved analyses: {workspace.analyses.length}
        </p>
      </div>
    </div>
  );
}

function Alerts({ view }: { view: ViewModel }) {
  const severityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  const sortedAlerts = [...view.alertItems].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const highCount = view.alertItems.filter((item) => item.severity === "HIGH").length;
  const mediumCount = view.alertItems.filter((item) => item.severity === "MEDIUM").length;
  const lowCount = view.alertItems.filter((item) => item.severity === "LOW").length;
  const alertGroups = [
    {
      title: "Churn Signals",
      items: sortedAlerts.filter((item) => /churn|negative|retention|repeat|feedback/.test(item.title.toLowerCase()) || item.severity === "HIGH"),
    },
    {
      title: "Revenue Signals",
      items: sortedAlerts.filter((item) => /revenue|payment|volume|stability/.test(item.title.toLowerCase()) || item.severity === "MEDIUM"),
    },
    {
      title: "Operational Signals",
      items: sortedAlerts.filter((item) => /delivery|service|feedback|confidence|trend|forecast|delay|support/.test(item.title.toLowerCase()) || item.severity === "LOW"),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="glass rounded-lg p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
              <AlertTriangle size={18} className="text-[#ff2d2d]" />
              Threat Monitor
            </p>
            <p className="mt-2 text-sm text-zinc-400">Imported negative feedback, consultant risks, and business alerts are surfaced here first.</p>
          </div>
          <div className="rounded-full border border-[#ff2d2d]/25 bg-[#ff2d2d]/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#ffb3b3]">
            Active alerts only
          </div>
        </div>

        <div className="mb-4 grid gap-3 xl:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-lg border border-[#ff2d2d]/30 bg-gradient-to-br from-[#2a070a] via-[#160507] to-[#090303] p-4 shadow-[0_0_0_1px_rgba(255,45,45,.10),0_20px_50px_rgba(0,0,0,.25)]">
            <div className="flex items-center gap-2 text-[#ff8d8d]">
              <ShieldAlert size={18} />
              <p className="text-xs uppercase tracking-[0.22em]">Threat posture</p>
            </div>
            <p className="mt-2 text-lg font-semibold text-white">Escalate negative feedback before it compounds.</p>
            <p className="mt-2 text-sm text-zinc-300">Every card below is pulled from real imported feedback or analysis signals, then ranked by severity.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <SeverityStat label="High" value={`${highCount}`} tone="high" />
            <SeverityStat label="Medium" value={`${mediumCount}`} tone="medium" />
            <SeverityStat label="Low" value={`${lowCount}`} tone="low" />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Top alerts</p>
          <div className="mt-3 grid gap-2">
            {sortedAlerts.slice(0, 5).map((item) => (
              <div
                key={`top-${item.title}-${item.source}`}
                className={`rounded-md border px-3 py-3 text-sm ${
                  item.severity === "HIGH"
                    ? "border-[#ff2d2d]/35 bg-[#ff2d2d]/12 text-[#ffd8d8]"
                    : item.severity === "MEDIUM"
                      ? "border-[#f97316]/35 bg-[#f97316]/10 text-[#ffe8d1]"
                      : "border-white/15 bg-[#17303a]/45 text-zinc-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid size-8 place-items-center rounded-lg ${
                        item.severity === "HIGH"
                          ? "bg-[#ff2d2d]/20 text-[#ff9b9b]"
                          : item.severity === "MEDIUM"
                            ? "bg-[#f97316]/20 text-[#ffcf9c]"
                            : "bg-white/10 text-[#8dd6ff]"
                      }`}
                    >
                      <AlertTriangle size={15} />
                    </span>
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{item.source}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${
                      item.severity === "HIGH"
                        ? "bg-[#ff2d2d]/20 text-[#ff9d9d]"
                        : item.severity === "MEDIUM"
                          ? "bg-[#f97316]/20 text-[#ffd0a7]"
                          : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {alertGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-4"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-[#ff2d2d]/15 text-[#ff8d8d]">
                  <AlertTriangle size={15} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{group.title}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Escalation queue</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {group.items.length > 0 ? (
                  group.items.map((item) => (
                    <div
                      key={`${item.title}-${item.source}`}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        item.severity === "HIGH"
                          ? "border-[#ff2d2d]/35 bg-[#ff2d2d]/15 text-[#ffd1d1]"
                          : item.severity === "MEDIUM"
                            ? "border-[#f97316]/35 bg-[#f97316]/12 text-[#ffe2c7]"
                            : "border-white/15 bg-white/5 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{item.title}</span>
                        <span className="text-[11px] uppercase tracking-[0.2em] opacity-80">{item.severity}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 opacity-90">{item.detail}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.source}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-400">
                    No active warnings right now.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <InsightsBox
        title="Alert Feed"
        icon={ShieldAlert}
        items={
          view.alertItems.length > 0
            ? view.alertItems.slice(0, 6).map((item) => `${item.severity}: ${item.title} — ${item.detail}`)
            : ["No negative signals are currently active.", "This tab will light up when churn or feedback pressure appears."]
        }
      />
    </div>
  );
}

function SeverityStat({ label, value, tone }: { label: string; value: string; tone: "high" | "medium" | "low" }) {
  const styles =
    tone === "high"
      ? "border-[#ff2d2d]/30 bg-[#ff2d2d]/12 text-[#ffd1d1]"
      : tone === "medium"
        ? "border-[#f97316]/30 bg-[#f97316]/12 text-[#ffe0bf]"
        : "border-white/10 bg-[#0f2430] text-[#cdefff]";
  return (
    <div className={`rounded-lg border p-4 ${styles}`}>
      <p className="text-xs uppercase tracking-[0.22em] opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] opacity-70">alerts</p>
    </div>
  );
}

function Consultant({
  view,
  workspace,
  consultantScope,
  setConsultantScope,
  consultantContext,
  setConsultantContext,
  onGenerate,
  onTemplateDownload,
  notice,
}: {
  view: ViewModel;
  workspace: Workspace;
  consultantScope: ConsultantScope;
  setConsultantScope: Dispatch<SetStateAction<ConsultantScope>>;
  consultantContext: {
    ownerGoal: string;
    recentChange: string;
    decision: string;
  };
  setConsultantContext: Dispatch<
    SetStateAction<{
      ownerGoal: string;
      recentChange: string;
      decision: string;
    }>
  >;
  onGenerate: () => void;
  onTemplateDownload: () => void;
  notice: string;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
      <div className="grid gap-4">
        <div className="card rounded-lg p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
            <Upload size={18} className="text-[#ff2d2d]" />
            File Templates
          </p>
          <div className="grid gap-3">
            <button onClick={onTemplateDownload} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10">
              <span>Download Excel template</span>
              <Download size={16} />
            </button>
          </div>
          <p className="mt-4 text-sm text-zinc-400">Headers: {TEMPLATE_HEADERS.join(", ")}.</p>
        </div>

      </div>

      <div className="grid gap-4">
        <div className="card rounded-lg p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
            <Brain size={18} className="text-[#ff2d2d]" />
            Consultant
          </p>
          <div className="grid gap-4">
            <SelectField
              label="Focus"
              value={consultantScope}
              onChange={(value) => setConsultantScope(value as ConsultantScope)}
              options={CONSULTANT_SCOPES.map((scope) => ({ label: scope, value: scope }))}
            />
            <label className="grid gap-2 text-sm text-zinc-400">
              Owner goal
              <input
                value={consultantContext.ownerGoal}
                onChange={(event) => setConsultantContext((current) => ({ ...current, ownerGoal: event.target.value }))}
                className="rounded-lg border border-white/10 bg-black/35 p-3 text-white outline-none focus:border-[#ff2d2d]"
                placeholder="What result matters most right now?"
              />
              <span className="text-xs text-zinc-500">Tell the model what the owner is trying to optimize.</span>
            </label>
            <label className="grid gap-2 text-sm text-zinc-400">
              Recent change
              <textarea
                value={consultantContext.recentChange}
                onChange={(event) => setConsultantContext((current) => ({ ...current, recentChange: event.target.value }))}
                className="min-h-20 rounded-lg border border-white/10 bg-black/35 p-3 text-white outline-none focus:border-[#ff2d2d]"
                placeholder="What shifted in the business, customers, or operations?"
              />
              <span className="text-xs text-zinc-500">This helps the consultant anchor the analysis in context, not just numbers.</span>
            </label>
            <label className="grid gap-2 text-sm text-zinc-400">
              Decision to make
              <textarea
                value={consultantContext.decision}
                onChange={(event) => setConsultantContext((current) => ({ ...current, decision: event.target.value }))}
                className="min-h-20 rounded-lg border border-white/10 bg-black/35 p-3 text-white outline-none focus:border-[#ff2d2d]"
                placeholder="What decision should the consultant help with next?"
              />
              <span className="text-xs text-zinc-500">Use the kind of question a founder would actually ask before a shift.</span>
            </label>
            <button
              onClick={onGenerate}
              disabled={workspace.rows.length === 0}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#ff2d2d] px-4 py-3 font-bold text-white transition hover:bg-[#ff4444] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles size={18} />
              Generate Intelligence
            </button>
          </div>
        </div>

        <div className="glass rounded-lg p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
            <Brain size={18} className="text-[#ff2d2d]" />
            Latest Consultant Read
          </p>
          {workspace.analyses[0] ? (
            <div className="grid gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Question</p>
                <p className="mt-2 text-base leading-7 text-zinc-200">{workspace.analyses[0].question}</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
                <div className="rounded-lg border border-[#ff2d2d]/30 bg-[#ff2d2d]/10 p-4">
                  <p className="text-sm text-zinc-400">Score</p>
                  <p className="mt-1 text-4xl font-extrabold">{workspace.analyses[0].score}</p>
                  <p className="mt-2 text-zinc-300">{workspace.analyses[0].headline}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Executive Summary</p>
                  <p className="mt-2 text-lg leading-8 text-zinc-100">{workspace.analyses[0].summary}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {workspace.analyses[0].signals.map((item) => (
                  <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
                    {item}
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {workspace.analyses[0].actions.map((item) => (
                  <div key={item} className="rounded-lg border border-[#ff2d2d]/25 bg-[#ff2d2d]/10 p-4 text-sm text-zinc-100">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-lg leading-8 text-zinc-300">
              Upload a file, choose a focus area, and generate a consultant read. The result is saved in the analysis trail
              so the client can review it inside the app.
            </p>
          )}
        </div>
      </div>

      <div className="xl:col-span-2">
        <HistoryPanel items={workspace.analyses} />
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <motion.div whileHover={{ y: -4 }} className="card rounded-lg p-5">
      <Icon className="mb-5 text-[#ff2d2d]" size={22} />
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{detail}</p>
    </motion.div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="font-semibold text-zinc-100">{value}</span>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactElement }) {
  return (
    <div className="card rounded-lg p-5">
      <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
        <Icon size={18} className="text-[#ff2d2d]" />
        {title}
      </p>
      <div className="chart h-[290px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function InsightsBox({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: string[] }) {
  return (
    <div className="glass rounded-lg p-5">
      <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
        <Icon size={18} className="text-[#ff2d2d]" />
        {title}
      </p>
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
            <CheckCircle2 size={18} className="shrink-0 text-[#22c55e]" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryPanel({ items }: { items: AnalysisRecord[] }) {
  return (
    <div className="card rounded-lg p-5">
      <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
        <Brain size={18} className="text-[#ff2d2d]" />
        Consultant History
      </p>
      <div className="grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-zinc-400">No saved consultant runs yet.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{item.headline}</span>
                <span className="text-xs text-zinc-500">{shortDate(item.createdAt)}</span>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Question</p>
              <p className="mt-1 text-sm text-zinc-300">{item.question}</p>
              <p className="mt-2 text-zinc-300">{item.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                <span>Scope: {item.scope}</span>
                <span>Score: {item.score}/100</span>
                <span>Rows: {item.sourceCount}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="grid gap-2 text-sm text-zinc-400">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-white/10 bg-black/35 p-3 text-white outline-none focus:border-[#ff2d2d]">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

const tooltipStyle = {
  background: "#111",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 8,
  color: "#fff",
};
