const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ─── Clients ──────────────────────────────────────────────────
const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" })
  : null;

// Dedicated Groq client for README generation (separate key = separate rate limit)
const groqReadme = process.env.GROQ_API_KEY_README
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY_README, baseURL: "https://api.groq.com/openai/v1" })
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

// ─── Provider: Groq (main) ───────────────────────────────────
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

// ─── Provider: Groq README (dedicated key) ───────────────────
async function callGroqReadme(prompt) {
  const client = groqReadme || groq; // fall back to main key if readme key missing
  if (!client) throw new Error("No Groq client available for README generation");
  console.log("[Groq-README] Calling llama-3.3-70b-versatile...");
  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const raw = response.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Groq-README returned invalid JSON. Raw: " + raw.slice(0, 300));
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

// ─── Cloud-specific Terraform instructions ────────────────────
const CLOUD_PROMPTS = {
  aws: {
    name: "AWS",
    provider: `terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}
provider "aws" { region = var.region }`,
    compute:        "t2.micro EC2 (free tier)",
    computeDocker:  "ECS Fargate (0.25 vCPU / 0.5 GB) with ECR repository for the container image",
    database:       "RDS db.t3.micro for PostgreSQL/MySQL, DocumentDB for MongoDB, ElastiCache for Redis",
    extras:         "Security Groups, IAM roles, S3 bucket if needed. Tag all resources: Name, Environment, Project.",
  },
  azure: {
    name: "Azure",
    provider: `terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.0" }
  }
}
provider "azurerm" { features {} }`,
    compute:        "Standard_B1s VM (free tier eligible)",
    computeDocker:  "Azure Container Instances (ACI) with Azure Container Registry (ACR)",
    database:       "Azure Database for PostgreSQL/MySQL Flexible Server, Cosmos DB for MongoDB, Azure Cache for Redis",
    extras:         "Resource Group, Virtual Network, NSG, Public IP. Tag all resources.",
  },
  gcp: {
    name: "GCP",
    provider: `terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.0" }
  }
}
provider "google" { project = var.project_id; region = var.region }`,
    compute:        "e2-micro Compute Engine VM (free tier)",
    computeDocker:  "Cloud Run service with Artifact Registry for the container image",
    database:       "Cloud SQL (PostgreSQL/MySQL), Firestore for MongoDB-like, Memorystore for Redis",
    extras:         "VPC, Firewall rules, Service Account. Label all resources.",
  },
  digitalocean: {
    name: "DigitalOcean",
    provider: `terraform {
  required_providers {
    digitalocean = { source = "digitalocean/digitalocean", version = "~> 2.0" }
  }
}
provider "digitalocean" { token = var.do_token }`,
    compute:        "s-1vcpu-1gb Droplet",
    computeDocker:  "App Platform (basic-xxs container) with Container Registry",
    database:       "Managed Database Cluster (PostgreSQL/MySQL/Redis/MongoDB)",
    extras:         "Project, Firewall, Domain if needed. Tag all resources.",
  },
  oracle: {
    name: "Oracle Cloud (OCI)",
    provider: `terraform {
  required_providers {
    oci = { source = "oracle/oci", version = "~> 5.0" }
  }
}
provider "oci" {}`,
    compute:        "VM.Standard.E2.1.Micro (Always Free tier)",
    computeDocker:  "OCI Container Instances with OCI Container Registry (OCIR)",
    database:       "Autonomous Database (free tier) for PostgreSQL/MySQL, NoSQL for MongoDB",
    extras:         "VCN, Security List, Internet Gateway. Tag all resources.",
  },
};

// ─── Native IaC (CloudFormation equivalent per cloud) ─────────
const NATIVE_IAC_PROMPTS = {
  aws: {
    name: "CloudFormation",
    format: "cloudformation",
    fileLabel: "template.yaml",
    fileKey: "templateYaml",
    instruction: `Generate a production-ready AWS CloudFormation YAML template.
AWSTemplateFormatVersion: "2010-09-09"
Use free-tier: t2.micro EC2 (or ECS Fargate if Docker detected), db.t3.micro RDS.
Include Parameters, Resources, Outputs sections.`,
    responseKey: "template_yaml",
  },
  azure: {
    name: "ARM Template",
    format: "arm",
    fileLabel: "azuredeploy.json",
    fileKey: "templateJson",
    instruction: `Generate a production-ready Azure ARM Template (JSON).
Use $schema: https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#
contentVersion: "1.0.0.0"
Use free-tier: Standard_B1s VM (or ACI if Docker detected).
Include parameters, variables, resources, outputs sections.`,
    responseKey: "template_json",
  },
  gcp: {
    name: "Deployment Manager",
    format: "deploymentmanager",
    fileLabel: "deployment.yaml",
    fileKey: "templateYaml",
    instruction: `Generate a production-ready GCP Deployment Manager YAML config.
Use e2-micro Compute Engine (or Cloud Run if Docker detected).
Include imports, resources, outputs sections with proper GCP resource types.`,
    responseKey: "template_yaml",
  },
  digitalocean: {
    name: "App Spec",
    format: "doappspec",
    fileLabel: "app.yaml",
    fileKey: "templateYaml",
    instruction: `Generate a production-ready DigitalOcean App Platform spec YAML.
Use basic-xxs size. Include services, databases, envs sections.
Follow the DO App Spec schema (name, region, services[].image or services[].github).`,
    responseKey: "template_yaml",
  },
  oracle: {
    name: "OCI Resource Manager",
    format: "ociresourcemanager",
    fileLabel: "stack.tf",
    fileKey: "templateTf",
    instruction: `Generate a production-ready OCI Resource Manager Terraform stack.
Use Always Free: VM.Standard.E2.1.Micro (or OCI Container Instances if Docker detected).
Include VCN, subnet, security list, compute instance, and outputs.`,
    responseKey: "template_tf",
  },
};

// ─── Generate Terraform ───────────────────────────────────────
async function generateTerraform(analysisResult, cloud = "aws") {
  const cp = CLOUD_PROMPTS[cloud] || CLOUD_PROMPTS.aws;
  const hasDocker = analysisResult.hasDocker === true;
  const computeNote = hasDocker
    ? `🐳 Dockerfile detected — use container-based compute: ${cp.computeDocker}`
    : `Compute: ${cp.compute}`;

  const prompt = `You are a senior DevOps engineer and Terraform expert.
Generate production-ready, modular Terraform code for ${cp.name} based on this project analysis.
Use free-tier / lowest-cost resources where possible. Add clear inline HCL comments.
Output ONLY a raw JSON object — no markdown, no code fences.

Project Analysis:
${JSON.stringify(analysisResult, null, 2)}

Provider block to use:
${cp.provider}

Requirements:
- ${computeNote}
- Database: ${cp.database}
- ${cp.extras}
- Variables for region, instance type, DB password, app port
- Outputs for public IP/hostname and DB endpoint

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
    cloud,
    hasDocker,
    mainTf:      unescape(parsed.main_tf      || ""),
    variablesTf: unescape(parsed.variables_tf || ""),
    outputsTf:   unescape(parsed.outputs_tf   || ""),
    summary:     parsed.summary    || "",
    confidence:  parsed.confidence || 0,
  };
}

// ─── Generate Native IaC (CloudFormation / ARM / etc.) ────────
async function generateNativeIaC(analysisResult, cloud = "aws") {
  const ni = NATIVE_IAC_PROMPTS[cloud] || NATIVE_IAC_PROMPTS.aws;
  const hasDocker = analysisResult.hasDocker === true;

  const prompt = `You are a senior DevOps engineer and ${ni.name} expert.
${ni.instruction}
${hasDocker ? "🐳 Dockerfile detected — use container-based compute instead of VMs." : ""}
Output ONLY a raw JSON object — no markdown, no code fences.

Project Analysis:
${JSON.stringify(analysisResult, null, 2)}

Return JSON with EXACTLY these keys:
{
  "${ni.responseKey}": "<complete ${ni.fileLabel} content as a string>",
  "summary": "<2-3 sentence description of what was provisioned>",
  "confidence": <integer 0-100>
}`;

  const parsed = await callLLM(prompt);
  const result = {
    format: ni.format,
    cloud,
    hasDocker,
    summary:    parsed.summary    || "",
    confidence: parsed.confidence || 0,
  };
  result[ni.fileKey] = unescape(parsed[ni.responseKey] || "");
  return result;
}

// generateReadme is appended below

// ─── Generate README / Deployment Guide ──────────────────────
async function generateReadme(iacResult, analysisResult) {
  const cloud = iacResult.cloud || "aws";
  const format = iacResult.format || "terraform";
  const hasDocker = iacResult.hasDocker === true;

  // Strip large file contents — only pass metadata to keep prompt small
  const iacMeta = {
    format,
    cloud,
    hasDocker,
    summary:    iacResult.summary    || "",
    confidence: iacResult.confidence || 0,
  };

  const isTerraform        = format === "terraform";
  const isCloudFormation   = format === "cloudformation";
  const isArm              = format === "arm";
  const isDeploymentManager = format === "deploymentmanager";
  const isDoAppSpec        = format === "doappspec";

  // Build deploy steps based on format
  let deploySteps = "";
  if (isTerraform) {
    deploySteps = `
## 🚀 Deployment Steps

### Prerequisites
- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.0 installed
- Cloud CLI configured (credentials set up for ${cloud.toUpperCase()})
${hasDocker ? "- Docker installed and running\n- Container registry access configured" : ""}

### Deploy

\`\`\`bash
# 1. Initialise Terraform — downloads providers
terraform init

# 2. Preview what will be created
terraform plan

# 3. Apply — creates all infrastructure
terraform apply
\`\`\`

### Destroy

\`\`\`bash
terraform destroy
\`\`\``;
  } else if (isCloudFormation) {
    deploySteps = `
## 🚀 Deployment Steps

### Prerequisites
- [AWS CLI](https://aws.amazon.com/cli/) installed and configured
- IAM permissions for CloudFormation, EC2, RDS

### Deploy

\`\`\`bash
# Deploy the stack
aws cloudformation deploy \\
  --template-file template.yaml \\
  --stack-name my-app-stack \\
  --capabilities CAPABILITY_IAM

# Check stack status
aws cloudformation describe-stacks --stack-name my-app-stack
\`\`\`

### Destroy

\`\`\`bash
aws cloudformation delete-stack --stack-name my-app-stack
\`\`\``;
  } else if (isArm) {
    deploySteps = `
## 🚀 Deployment Steps

### Prerequisites
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- \`az login\` completed

### Deploy

\`\`\`bash
# Create resource group (if needed)
az group create --name my-app-rg --location eastus

# Deploy ARM template
az deployment group create \\
  --resource-group my-app-rg \\
  --template-file azuredeploy.json \\
  --parameters @azuredeploy.parameters.json
\`\`\`

### Destroy

\`\`\`bash
az group delete --name my-app-rg --yes
\`\`\``;
  } else if (isDeploymentManager) {
    deploySteps = `
## 🚀 Deployment Steps

### Prerequisites
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed
- \`gcloud auth login\` completed

### Deploy

\`\`\`bash
# Deploy
gcloud deployment-manager deployments create my-app \\
  --config deployment.yaml

# Check status
gcloud deployment-manager deployments describe my-app
\`\`\`

### Destroy

\`\`\`bash
gcloud deployment-manager deployments delete my-app
\`\`\``;
  } else if (isDoAppSpec) {
    deploySteps = `
## 🚀 Deployment Steps

### Prerequisites
- [doctl](https://docs.digitalocean.com/reference/doctl/) installed
- \`doctl auth init\` completed

### Deploy

\`\`\`bash
# Create app from spec
doctl apps create --spec app.yaml

# List apps
doctl apps list
\`\`\`

### Destroy

\`\`\`bash
doctl apps delete <app-id>
\`\`\``;
  }

  // Trim analysisResult — only keep what's needed for the README
  const analysisMeta = {
    services:      analysisResult.services      || [],
    envVars:       (analysisResult.envVars || []).slice(0, 20),
    hasDocker:     analysisResult.hasDocker     || false,
    summary:       analysisResult.summary       || "",
    detectedFiles: (analysisResult.detectedFiles || []).slice(0, 10),
  };

  const prompt = `You are a senior DevOps engineer writing a deployment README.
Generate a complete, well-structured README.md for deploying this infrastructure.
Output ONLY a raw JSON object — no markdown fences around the JSON itself.

IaC Format: ${format}
Cloud: ${cloud}
Docker: ${hasDocker}
IaC Summary: ${iacMeta.summary}

Project Analysis:
${JSON.stringify(analysisMeta, null, 2)}

The README must include these sections IN ORDER:
1. # Project Infrastructure — title with cloud + format badge
2. ## Overview — 2-3 sentences about what is provisioned
3. ## Architecture — bullet list of resources created (compute, DB, networking)
4. ## Prerequisites — tools needed with install links
5. ## Configuration — table of variables/parameters with description and default
6. ## 🚀 Deployment Steps — use EXACTLY the steps provided below
7. ## Access Your App — how to get the public URL/IP after deploy
8. ## Environment Variables — table of env vars the app needs
9. ## Estimated Cost — rough monthly cost for the chosen cloud tier
10. ## Cleanup — how to destroy all resources

Use proper markdown: code blocks with language hints, tables, badges.
For the deploy steps section, use EXACTLY this content:
${deploySteps}

Return JSON with EXACTLY this key:
{
  "readme": "<complete README.md content as a string>"
}`;

  const parsed = await callGroqReadme(prompt);
  return { readme: unescape(parsed.readme || "") };
}

module.exports = { generateTerraform, generateNativeIaC, generateReadme };
