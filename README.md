# Code-to-Cloud: AI Terraform Generator

Paste a GitHub URL or upload a ZIP → get production-ready Terraform in seconds.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- LLM: OpenAI GPT-4o
- IaC Output: Terraform (AWS)

## Project Structure

```
code-to-cloud/
  frontend/          React UI
  backend/
    controllers/     /analyze and /generate routes
    services/        Detection logic + LLM integration
    utils/           File helpers
    templates/       Example Terraform output
    uploads/         Temp storage (auto-cleaned)
```

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Add your OPENAI_API_KEY to .env
npm install
npm run dev
# Runs on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

## API Reference

### POST /analyze

Accepts either a GitHub URL or ZIP upload.

```bash
# GitHub URL
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/user/repo"}'

# ZIP upload
curl -X POST http://localhost:5000/analyze \
  -F "zipFile=@project.zip"
```

Response:
```json
{
  "services": [
    { "type": "backend", "language": "nodejs", "framework": "express", "port": 3000 },
    { "type": "backend", "language": "nodejs", "database": "mongodb" }
  ],
  "envVars": ["PORT", "MONGO_URI"],
  "summary": "Detected: express | Databases: mongodb"
}
```

### POST /generate

```bash
curl -X POST http://localhost:5000/generate \
  -H "Content-Type: application/json" \
  -d '{"services": [{"type": "backend", "framework": "express", "database": "mongodb"}]}'
```

Response:
```json
{
  "mainTf": "...",
  "variablesTf": "...",
  "outputsTf": "...",
  "summary": "Provisions a t2.micro EC2 instance with DocumentDB...",
  "confidence": 87
}
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Your OpenAI API key |
| `PORT` | No | Backend port (default: 5000) |
| `AWS_REGION` | No | Default AWS region for Terraform |
