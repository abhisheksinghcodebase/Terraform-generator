const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Primary model — gemini-2.0-flash
// Fallback — gemini-2.0-flash-lite (lower quota usage, still capable)
const MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];

function getModel(name) {
  return genAI.getGenerativeModel({
    model: name,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
}

function stripFences(raw) {
  return raw.replace(/^```(?:json|yaml|hcl)?\s*/i, "").replace(/\s*```$/, "").trim();
}

/**
 * Call Gemini — tries primary model, falls back to lite on 429.
 * On persistent 429, waits up to 60s (the free-tier reset window).
 */
async function callGemini(prompt) {
  for (const modelName of MODELS) {
    const model = getModel(modelName);
    // Try each model up to 3 times with increasing wait
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Gemini] Using ${modelName}, attempt ${attempt}`);
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        const cleaned = stripFences(raw);
        try {
          return JSON.parse(cleaned);
        } catch {
          throw new Error("Gemini returned invalid JSON. Raw: " + raw.slice(0, 300));
        }
      } catch (err) {
        const is429 = err.message?.includes("429");
        if (!is429) throw err; // non-rate-limit error — fail immediately

        if (attempt < 3) {
          // Wait longer each attempt: 15s → 30s → give up and try next model
          const wait = attempt * 15000;
          console.log(`[Gemini] Rate limited on ${modelName}. Waiting ${wait / 1000}s...`);
          await new Promise((r) => setTimeout(r, wait));
        } else {
          console.log(`[Gemini] ${modelName} exhausted, trying next model...`);
        }
      }
    }
  }

  // All models exhausted
  throw new Error(
    "Gemini rate limit exceeded on all models. The free tier allows 15 requests/min — please wait 60 seconds and try again."
  );
}

/**
 * Generate Terraform (main.tf / variables.tf / outputs.tf)
 */
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

  const parsed = await callGemini(prompt);
  return {
    format: "terraform",
    mainTf: parsed.main_tf || "",
    variablesTf: parsed.variables_tf || "",
    outputsTf: parsed.outputs_tf || "",
    summary: parsed.summary || "",
    confidence: parsed.confidence || 0,
  };
}

/**
 * Generate CloudFormation (template.yaml)
 */
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

  const parsed = await callGemini(prompt);
  return {
    format: "cloudformation",
    templateYaml: parsed.template_yaml || "",
    summary: parsed.summary || "",
    confidence: parsed.confidence || 0,
  };
}

module.exports = { generateTerraform, generateCloudFormation };
