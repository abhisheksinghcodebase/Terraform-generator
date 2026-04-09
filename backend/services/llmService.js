const OpenAI = require("openai");

// Initialize OpenAI client — key loaded from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // <-- set in .env
});

/**
 * Generate Terraform code from structured analysis JSON.
 * Returns { mainTf, variablesTf, outputsTf, summary, confidence }
 */
async function generateTerraform(analysisResult) {
  const prompt = buildPrompt(analysisResult);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a senior DevOps engineer and Terraform expert. 
You generate production-ready, modular Terraform code for AWS.
Always use AWS free-tier resources where possible.
Add clear comments explaining each resource.
Output ONLY valid JSON in the exact format requested — no markdown, no explanation outside JSON.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0].message.content;

  try {
    const parsed = JSON.parse(raw);
    return {
      mainTf: parsed.main_tf || "",
      variablesTf: parsed.variables_tf || "",
      outputsTf: parsed.outputs_tf || "",
      summary: parsed.summary || "",
      confidence: parsed.confidence || 0,
    };
  } catch {
    throw new Error("LLM returned invalid JSON. Raw: " + raw.slice(0, 200));
  }
}

/**
 * Build the LLM prompt from the analysis result
 */
function buildPrompt(analysis) {
  return `
You are given a structured JSON analysis of a software project.
Generate production-ready Terraform code for deploying this project on AWS.

Project Analysis:
${JSON.stringify(analysis, null, 2)}

Requirements:
- Use AWS free-tier resources (t2.micro EC2, db.t3.micro RDS if needed)
- Create security groups with minimal required ports
- Use variables for all configurable values (region, instance type, etc.)
- Add output values for important resource attributes
- Add inline comments explaining each resource block
- Modular structure: separate main.tf, variables.tf, outputs.tf
- If a database is detected, provision the appropriate AWS managed service (RDS for PostgreSQL/MySQL, DocumentDB for MongoDB)
- If Redis is detected, provision ElastiCache
- Tag all resources with Name, Environment, and Project tags

Return a JSON object with exactly these keys:
{
  "main_tf": "<full content of main.tf>",
  "variables_tf": "<full content of variables.tf>",
  "outputs_tf": "<full content of outputs.tf>",
  "summary": "<2-3 sentence plain English description of what was provisioned>",
  "confidence": <integer 0-100 representing how confident you are in the output>
}
`;
}

module.exports = { generateTerraform };
