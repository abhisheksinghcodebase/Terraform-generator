const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ─── Clients ──────────────────────────────────────────────────
// Groq uses the OpenAI-compatible SDK — just a different baseURL + model
const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// ─── Helper ───────────────────────────────────────────────────
const unescape = (s) =>
  typeof s === "string" ? s.replace(/\\n/g, "\n").replace(/\\t/g, "\t") : s;

function stripFences(raw) {
  return raw.replace(/^```(?:json|yaml|hcl)?\s*/i, "").replace(/\s*```$/, "").trim();
}

// ─── Provider: Groq ──────────────────────────────────────────
async function callGroq(prompt) {
  console.log("[Groq] Calling llama-3.3-70b-versatile...");
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const raw = response.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Groq returned invalid JSON. Raw: " + raw.slice(0, 300));
  }
}

// ─── Provider: OpenAI ────────────────────────────────────────
async function callOpenAI(prompt) {
  console.log("[OpenAI] Calling gpt-4o-mini...");
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const raw = response.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON. Raw: " + raw.slice(0, 300));
  }
}

// ─── Provider: Gemini ────────────────────────────────────────
let lastGeminiCall = 0;
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];

async function callGemini(prompt) {
  for (const modelName of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    });
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        // enforce 4s gap between Gemini calls
        const wait = 4000 - (Date.now() - lastGeminiCall);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastGeminiCall = Date.now();

        console.log(`[Gemini] ${modelName} attempt ${attempt}`);
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        return JSON.parse(stripFences(raw));
      } catch (err) {
        if (!err.message?.includes("429")) throw err;
        if (attempt === 1) {
          console.log(`[Gemini] 429 — waiting 60s for quota reset...`);
          await new Promise((r) => setTimeout(r, 60000));
        }
      }
    }
  }
  throw new Error("Gemini rate limit exceeded on all models.");
}

// ─── Dispatcher: Groq → OpenAI → Gemini ──────────────────────
async function callLLM(prompt) {
  if (groq) {
    try { return await callGroq(prompt); }
    catch (err) { console.warn(`[LLM] Groq failed (${err.message}), trying OpenAI...`); }
  }
  if (openai) {
    try { return await callOpenAI(prompt); }
    catch (err) { console.warn(`[LLM] OpenAI failed (${err.message}), trying Gemini...`); }
  }
  if (genAI) {
    return callGemini(prompt);
  }
  throw new Error("No LLM provider configured. Set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in .env");
}

// ─── Generate Terraform ───────────────────────────────────────
async function generateTerraform(analysisResult) {
  const prompt = `You are a senior DevOps engineer and Terraform expert.
Generate production-ready, modular Terraform code for AWS based on this project analysis.
Use AWS free-tier resources. Add clear inline HCL comments.
Output ONLY a raw JSON object — no markdown, no code fences.

Project Analysis:
${JSON.stringify(analysisResult, null, 2)}

Requirements:
- Free-tier: t2.micro EC2, db.t3.micro RDS
- Security groups with minimal required ports
- Variables for region, instance type, DB password, app port
- Outputs for EC2 public IP, DNS, DB endpoint
- If database detected: RDS for PostgreSQL/MySQL, DocumentDB for MongoDB, ElastiCache for Redis
- Tag all resources: Name, Environment, Project

Return JSON with EXACTLY these keys:
{
  "main_tf": "<complete main.tf content>",
  "variables_tf": "<complete variables.tf content>",
  "outputs_tf": "<complete outputs.tf content>",
  "summary": "<2-3 sentence description of what was provisioned>",
  "confidence": <integer 0-100>
}`;

  const parsed = await callLLM(prompt);
  return {
    format: "terraform",
    mainTf: unescape(parsed.main_tf || ""),
    variablesTf: unescape(parsed.variables_tf || ""),
    outputsTf: unescape(parsed.outputs_tf || ""),
    summary: parsed.summary || "",
    confidence: parsed.confidence || 0,
  };
}

// ─── Generate CloudFormation ──────────────────────────────────
async function generateCloudFormation(analysisResult) {
  const prompt = `You are a senior DevOps engineer and AWS CloudFormation expert.
Generate a production-ready CloudFormation YAML template based on this project analysis.
Use AWS free-tier resources. Add clear YAML comments.
Output ONLY a raw JSON object — no markdown, no code fences.

Project Analysis:
${JSON.stringify(analysisResult, null, 2)}

Requirements:
- AWSTemplateFormatVersion: "2010-09-09"
- Free-tier: t2.micro EC2, db.t3.micro RDS
- Parameters for instance type, DB password, app port
- Outputs for EC2 public IP, DB endpoint
- Security Groups with minimal required ports
- If database detected: RDS for PostgreSQL/MySQL, DocumentDB for MongoDB, ElastiCache for Redis
- Tag all resources: Name, Environment, Project

Return JSON with EXACTLY these keys:
{
  "template_yaml": "<complete CloudFormation YAML as a string>",
  "summary": "<2-3 sentence description of what was provisioned>",
  "confidence": <integer 0-100>
}`;

  const parsed = await callLLM(prompt);
  return {
    format: "cloudformation",
    templateYaml: unescape(parsed.template_yaml || ""),
    summary: parsed.summary || "",
    confidence: parsed.confidence || 0,
  };
}

module.exports = { generateTerraform, generateCloudFormation };
