import { useState } from "react";
import styles from "./DeployGuide.module.css";

// ─── Per-cloud, per-format deployment guide data ──────────────
const GUIDES = {
  // ── TERRAFORM guides (all clouds) ──
  terraform: {
    aws: {
      prereqs: [
        { label: "Terraform ≥ 1.0", url: "https://developer.hashicorp.com/terraform/downloads" },
        { label: "AWS CLI v2",       url: "https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html" },
      ],
      setup: [
        { cmd: "aws configure", note: "Enter Access Key ID, Secret, region (e.g. us-east-1)" },
      ],
      steps: [
        { cmd: "terraform init",    note: "Downloads the AWS provider plugin" },
        { cmd: "terraform plan",    note: "Preview resources — check for errors before applying" },
        { cmd: "terraform apply",   note: "Type yes to create all infrastructure on AWS" },
        { cmd: "terraform output",  note: "Get your EC2 public IP / ECS service URL" },
      ],
      access: "terraform output app_url  # or check EC2 console → Public IPv4",
      destroy: "terraform destroy",
      tips: [
        "Free-tier EC2 (t2.micro) is valid for 12 months on new accounts",
        "Store terraform.tfstate in S3 for team use — never commit it to git",
        "Set TF_VAR_db_password env var instead of typing it each time",
      ],
      docsUrl: "https://registry.terraform.io/providers/hashicorp/aws/latest/docs",
    },
    azure: {
      prereqs: [
        { label: "Terraform ≥ 1.0", url: "https://developer.hashicorp.com/terraform/downloads" },
        { label: "Azure CLI",        url: "https://learn.microsoft.com/en-us/cli/azure/install-azure-cli" },
      ],
      setup: [
        { cmd: "az login",                    note: "Opens browser for Microsoft login" },
        { cmd: "az account set --subscription <id>", note: "Select the right subscription" },
      ],
      steps: [
        { cmd: "terraform init",   note: "Downloads the AzureRM provider" },
        { cmd: "terraform plan",   note: "Preview Azure resources" },
        { cmd: "terraform apply",  note: "Provisions Resource Group, VM/ACI, DB, VNet" },
        { cmd: "terraform output", note: "Get public IP or FQDN" },
      ],
      access: "terraform output public_ip  # or Azure Portal → Resource Group",
      destroy: "terraform destroy",
      tips: [
        "Standard_B1s VM is free for 12 months on new Azure accounts",
        "Use azurerm_storage_account + azurerm_storage_blob for remote state",
        "Set ARM_CLIENT_ID / ARM_CLIENT_SECRET for CI/CD pipelines",
      ],
      docsUrl: "https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs",
    },
    gcp: {
      prereqs: [
        { label: "Terraform ≥ 1.0", url: "https://developer.hashicorp.com/terraform/downloads" },
        { label: "gcloud CLI",       url: "https://cloud.google.com/sdk/docs/install" },
      ],
      setup: [
        { cmd: "gcloud auth application-default login", note: "Authenticates Terraform with GCP" },
        { cmd: "gcloud config set project <PROJECT_ID>", note: "Set your GCP project" },
      ],
      steps: [
        { cmd: "terraform init",   note: "Downloads the Google provider" },
        { cmd: "terraform plan",   note: "Preview Compute Engine / Cloud Run resources" },
        { cmd: "terraform apply",  note: "Creates VPC, VM/Cloud Run, Cloud SQL, firewall rules" },
        { cmd: "terraform output", note: "Get external IP or Cloud Run URL" },
      ],
      access: "terraform output app_url  # Cloud Run gives a direct HTTPS URL",
      destroy: "terraform destroy",
      tips: [
        "e2-micro is always free (1 per region) — no 12-month limit",
        "Enable required APIs first: compute.googleapis.com, sqladmin.googleapis.com",
        "Use GCS bucket for remote Terraform state",
      ],
      docsUrl: "https://registry.terraform.io/providers/hashicorp/google/latest/docs",
    },
    digitalocean: {
      prereqs: [
        { label: "Terraform ≥ 1.0", url: "https://developer.hashicorp.com/terraform/downloads" },
        { label: "doctl CLI",        url: "https://docs.digitalocean.com/reference/doctl/how-to/install/" },
      ],
      setup: [
        { cmd: "export TF_VAR_do_token=<YOUR_DO_TOKEN>", note: "Get token from DO console → API" },
      ],
      steps: [
        { cmd: "terraform init",   note: "Downloads the DigitalOcean provider" },
        { cmd: "terraform plan",   note: "Preview Droplet / App Platform resources" },
        { cmd: "terraform apply",  note: "Creates Droplet, Managed DB, Firewall, Project" },
        { cmd: "terraform output", note: "Get Droplet IP or App URL" },
      ],
      access: "terraform output droplet_ip  # or DO console → Networking",
      destroy: "terraform destroy",
      tips: [
        "DigitalOcean has no free tier — cheapest Droplet is $4/mo (s-1vcpu-512mb)",
        "Use DO Spaces (S3-compatible) for remote Terraform state",
        "Add your SSH key fingerprint to variables.tf for Droplet access",
      ],
      docsUrl: "https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs",
    },
    oracle: {
      prereqs: [
        { label: "Terraform ≥ 1.0", url: "https://developer.hashicorp.com/terraform/downloads" },
        { label: "OCI CLI",          url: "https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm" },
      ],
      setup: [
        { cmd: "oci setup config", note: "Generates ~/.oci/config with tenancy OCID, user OCID, key" },
      ],
      steps: [
        { cmd: "terraform init",   note: "Downloads the OCI provider" },
        { cmd: "terraform plan",   note: "Preview Always Free VM / Container Instance" },
        { cmd: "terraform apply",  note: "Creates VCN, subnet, compute instance, security list" },
        { cmd: "terraform output", note: "Get public IP" },
      ],
      access: "terraform output instance_public_ip",
      destroy: "terraform destroy",
      tips: [
        "OCI Always Free includes 2× VM.Standard.E2.1.Micro — no expiry",
        "Set TF_VAR_compartment_id to your root compartment OCID",
        "Use OCI Object Storage for remote Terraform state",
      ],
      docsUrl: "https://registry.terraform.io/providers/oracle/oci/latest/docs",
    },
  },

  // ── NATIVE IaC guides ──
  cloudformation: {
    aws: {
      prereqs: [
        { label: "AWS CLI v2", url: "https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html" },
      ],
      setup: [
        { cmd: "aws configure", note: "Enter Access Key ID, Secret, region" },
      ],
      steps: [
        { cmd: "aws cloudformation validate-template --template-body file://template.yaml", note: "Validate before deploying" },
        { cmd: "aws cloudformation deploy --template-file template.yaml --stack-name my-app --capabilities CAPABILITY_IAM", note: "Deploy the stack" },
        { cmd: "aws cloudformation describe-stacks --stack-name my-app --query 'Stacks[0].Outputs'", note: "Get outputs (IP, endpoint)" },
      ],
      access: "Check Outputs tab in AWS Console → CloudFormation → my-app",
      destroy: "aws cloudformation delete-stack --stack-name my-app",
      tips: [
        "Use --parameter-overrides key=value to pass parameters",
        "Enable stack termination protection in production",
        "CloudFormation is free — you only pay for the resources it creates",
      ],
      docsUrl: "https://docs.aws.amazon.com/cloudformation/",
    },
  },
  arm: {
    azure: {
      prereqs: [
        { label: "Azure CLI", url: "https://learn.microsoft.com/en-us/cli/azure/install-azure-cli" },
      ],
      setup: [
        { cmd: "az login", note: "Authenticate with Azure" },
        { cmd: "az group create --name my-app-rg --location eastus", note: "Create resource group" },
      ],
      steps: [
        { cmd: "az deployment group validate --resource-group my-app-rg --template-file azuredeploy.json", note: "Validate template" },
        { cmd: "az deployment group create --resource-group my-app-rg --template-file azuredeploy.json --parameters @azuredeploy.parameters.json", note: "Deploy" },
        { cmd: "az deployment group show --resource-group my-app-rg --name azuredeploy --query properties.outputs", note: "Get outputs" },
      ],
      access: "Azure Portal → Resource Group → my-app-rg → Overview",
      destroy: "az group delete --name my-app-rg --yes --no-wait",
      tips: [
        "Create azuredeploy.parameters.json for environment-specific values",
        "Use --what-if flag to preview changes before deploying",
        "ARM deployments are idempotent — safe to re-run",
      ],
      docsUrl: "https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/",
    },
  },
  deploymentmanager: {
    gcp: {
      prereqs: [
        { label: "gcloud CLI", url: "https://cloud.google.com/sdk/docs/install" },
      ],
      setup: [
        { cmd: "gcloud auth login", note: "Authenticate" },
        { cmd: "gcloud config set project <PROJECT_ID>", note: "Set project" },
      ],
      steps: [
        { cmd: "gcloud deployment-manager deployments create my-app --config deployment.yaml", note: "Deploy" },
        { cmd: "gcloud deployment-manager deployments describe my-app", note: "Check status and outputs" },
        { cmd: "gcloud deployment-manager deployments update my-app --config deployment.yaml", note: "Update existing deployment" },
      ],
      access: "gcloud compute instances list  # or GCP Console → Compute Engine",
      destroy: "gcloud deployment-manager deployments delete my-app",
      tips: [
        "Enable Deployment Manager API: gcloud services enable deploymentmanager.googleapis.com",
        "Use --preview flag to see changes before applying",
        "Outputs are visible in GCP Console → Deployment Manager",
      ],
      docsUrl: "https://cloud.google.com/deployment-manager/docs",
    },
  },
  doappspec: {
    digitalocean: {
      prereqs: [
        { label: "doctl CLI", url: "https://docs.digitalocean.com/reference/doctl/how-to/install/" },
      ],
      setup: [
        { cmd: "doctl auth init", note: "Paste your DO API token" },
      ],
      steps: [
        { cmd: "doctl apps create --spec app.yaml", note: "Create the app from spec" },
        { cmd: "doctl apps list", note: "Get app ID and live URL" },
        { cmd: "doctl apps update <app-id> --spec app.yaml", note: "Update existing app" },
      ],
      access: "doctl apps list  # shows the live URL directly",
      destroy: "doctl apps delete <app-id>",
      tips: [
        "App Platform auto-deploys on git push if you link a GitHub repo",
        "Use doctl apps logs <app-id> to stream runtime logs",
        "Basic-xxs starts at $5/mo — scales automatically",
      ],
      docsUrl: "https://docs.digitalocean.com/products/app-platform/",
    },
  },
  ociresourcemanager: {
    oracle: {
      prereqs: [
        { label: "OCI CLI", url: "https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm" },
      ],
      setup: [
        { cmd: "oci setup config", note: "Configure tenancy OCID, user OCID, API key" },
      ],
      steps: [
        { cmd: "oci resource-manager stack create --compartment-id <OCID> --config-source stack.tf --display-name my-app", note: "Create stack" },
        { cmd: "oci resource-manager job create-plan-job --stack-id <STACK_ID>", note: "Plan" },
        { cmd: "oci resource-manager job create-apply-job --stack-id <STACK_ID>", note: "Apply" },
      ],
      access: "OCI Console → Resource Manager → Stacks → my-app → Outputs",
      destroy: "oci resource-manager job create-destroy-job --stack-id <STACK_ID>",
      tips: [
        "OCI Resource Manager has a web UI — upload stack.tf as a zip",
        "Always Free tier includes 2 VMs, 200 GB storage, 10 TB outbound",
        "Use OCI Vault to store secrets instead of variables.tf",
      ],
      docsUrl: "https://docs.oracle.com/en-us/iaas/Content/ResourceManager/home.htm",
    },
  },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button className={styles.copyBtn} onClick={handleCopy} title="Copy command">
      {copied ? "✓" : "⎘"}
    </button>
  );
}

export default function DeployGuide({ iac }) {
  const format = iac.format || "terraform";
  const cloud  = iac.cloud  || "aws";

  const guide = GUIDES[format]?.[cloud] || GUIDES.terraform?.aws;
  if (!guide) return null;

  const CLOUD_NAMES = {
    aws: "AWS", azure: "Azure", gcp: "GCP",
    digitalocean: "DigitalOcean", oracle: "Oracle Cloud",
  };
  const FORMAT_NAMES = {
    terraform: "Terraform", cloudformation: "CloudFormation",
    arm: "ARM Template", deploymentmanager: "Deployment Manager",
    doappspec: "App Spec", ociresourcemanager: "Resource Manager",
  };

  return (
    <div className={styles.guide}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.rocketIcon}>🚀</span>
          <div>
            <h3 className={styles.title}>
              How to Deploy on {CLOUD_NAMES[cloud]} using {FORMAT_NAMES[format]}
            </h3>
            <p className={styles.subtitle}>
              Step-by-step guide — run these commands after downloading your files
            </p>
          </div>
        </div>
        <a
          href={guide.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.docsLink}
        >
          📖 Official Docs ↗
        </a>
      </div>

      <div className={styles.body}>
        {/* ── Prerequisites ── */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>1</span> Prerequisites
          </h4>
          <div className={styles.prereqList}>
            {guide.prereqs.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className={styles.prereqChip}>
                ↗ {p.label}
              </a>
            ))}
          </div>
        </section>

        {/* ── Setup / Auth ── */}
        {guide.setup?.length > 0 && (
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>
              <span className={styles.sectionNum}>2</span> Authenticate
            </h4>
            <div className={styles.cmdList}>
              {guide.setup.map((s, i) => (
                <div key={i} className={styles.cmdRow}>
                  <div className={styles.cmdBlock}>
                    <span className={styles.prompt}>$</span>
                    <code className={styles.cmd}>{s.cmd}</code>
                    <CopyButton text={s.cmd} />
                  </div>
                  {s.note && <span className={styles.cmdNote}># {s.note}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Deploy steps ── */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>3</span> Deploy
          </h4>
          <div className={styles.cmdList}>
            {guide.steps.map((s, i) => (
              <div key={i} className={styles.cmdRow}>
                <div className={styles.cmdBlock}>
                  <span className={styles.stepIdx}>{i + 1}</span>
                  <span className={styles.prompt}>$</span>
                  <code className={styles.cmd}>{s.cmd}</code>
                  <CopyButton text={s.cmd} />
                </div>
                {s.note && <span className={styles.cmdNote}># {s.note}</span>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Access app ── */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>4</span> Access Your App
          </h4>
          <div className={styles.cmdRow}>
            <div className={styles.cmdBlock}>
              <span className={styles.prompt}>$</span>
              <code className={styles.cmd}>{guide.access}</code>
              <CopyButton text={guide.access} />
            </div>
          </div>
        </section>

        {/* ── Cleanup ── */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>5</span> Cleanup
          </h4>
          <div className={styles.cmdRow}>
            <div className={`${styles.cmdBlock} ${styles.destroyBlock}`}>
              <span className={styles.prompt}>$</span>
              <code className={styles.cmd}>{guide.destroy}</code>
              <CopyButton text={guide.destroy} />
            </div>
          </div>
        </section>

        {/* ── Tips ── */}
        {guide.tips?.length > 0 && (
          <section className={styles.tipsSection}>
            <h4 className={styles.tipsSectionTitle}>💡 Pro Tips</h4>
            <ul className={styles.tipsList}>
              {guide.tips.map((t, i) => (
                <li key={i} className={styles.tip}>{t}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
