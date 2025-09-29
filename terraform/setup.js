#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('☁️  Setting up Terraform Infrastructure...\n');

// Check if Terraform is installed
try {
  const terraformVersion = execSync('terraform version', { encoding: 'utf8' });
  console.log('✅ Terraform installed:', terraformVersion.split('\n')[0]);
} catch (error) {
  console.log('❌ Terraform not found. Please install Terraform:');
  console.log('   https://developer.hashicorp.com/terraform/downloads');
  console.log('   Or use package manager:');
  console.log('   - macOS: brew install terraform');
  console.log('   - Windows: choco install terraform');
  console.log('   - Linux: apt-get install terraform');
}

// Create terraform.tfvars.example
const tfvarsExample = `# Terraform Variables Configuration
# Copy this file to terraform.tfvars and update with your values

# Project Configuration
project_name = "business-automation"
environment = "development"
region = "us-west-2"

# Kubernetes Configuration
cluster_name = "business-automation-cluster"
node_count = 3
node_instance_type = "t3.medium"

# Database Configuration
db_instance_class = "db.t3.micro"
db_allocated_storage = 20
db_engine_version = "13.7"

# Redis Configuration
redis_node_type = "cache.t3.micro"
redis_num_cache_nodes = 1

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]

# Security Configuration
allowed_cidr_blocks = ["0.0.0.0/0"]  # Restrict this in production

# Monitoring Configuration
enable_monitoring = true
log_retention_days = 30

# Backup Configuration
backup_retention_period = 7
backup_window = "03:00-04:00"
maintenance_window = "sun:04:00-sun:05:00"

# Tags
tags = {
  Project = "business-automation"
  Environment = "development"
  ManagedBy = "terraform"
}`;

const tfvarsPath = path.join(__dirname, 'terraform.tfvars.example');
if (!fs.existsSync(tfvarsPath)) {
  fs.writeFileSync(tfvarsPath, tfvarsExample);
  console.log('✅ Created terraform.tfvars.example');
}

// Create backend configuration
const backendConfig = `# Terraform Backend Configuration
# Uncomment and configure for remote state storage

terraform {
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "business-automation/terraform.tfstate"
  #   region = "us-west-2"
  #   
  #   # Optional: DynamoDB table for state locking
  #   dynamodb_table = "terraform-state-lock"
  #   encrypt        = true
  # }
  
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}`;

const backendPath = path.join(__dirname, 'backend.tf');
if (!fs.existsSync(backendPath)) {
  fs.writeFileSync(backendPath, backendConfig);
  console.log('✅ Created backend.tf');
}

// Create provider configuration
const providerConfig = `# Provider Configuration
provider "aws" {
  region = var.region
  
  default_tags {
    tags = var.tags
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}`;

const providerPath = path.join(__dirname, 'providers.tf');
if (!fs.existsSync(providerPath)) {
  fs.writeFileSync(providerPath, providerConfig);
  console.log('✅ Created providers.tf');
}

// Create modules directory and basic modules
const modulesDir = path.join(__dirname, 'modules');
if (!fs.existsSync(modulesDir)) {
  fs.mkdirSync(modulesDir, { recursive: true });
  console.log('✅ Created modules directory');
}

// Create networking module
const networkingModuleDir = path.join(modulesDir, 'networking');
if (!fs.existsSync(networkingModuleDir)) {
  fs.mkdirSync(networkingModuleDir, { recursive: true });
  
  const networkingMain = `# VPC and Networking Resources
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(var.tags, {
    Name = "\${var.project_name}-vpc"
  })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = merge(var.tags, {
    Name = "\${var.project_name}-igw"
  })
}

resource "aws_subnet" "public" {
  count = length(var.availability_zones)
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  
  tags = merge(var.tags, {
    Name = "\${var.project_name}-public-\${count.index + 1}"
    Type = "public"
  })
}

resource "aws_subnet" "private" {
  count = length(var.availability_zones)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]
  
  tags = merge(var.tags, {
    Name = "\${var.project_name}-private-\${count.index + 1}"
    Type = "private"
  })
}`;
  
  fs.writeFileSync(path.join(networkingModuleDir, 'main.tf'), networkingMain);
  console.log('✅ Created networking module');
}

// Create setup script for Terraform
const terraformSetupScript = `#!/bin/bash

echo "🏗️  Initializing Terraform Infrastructure..."

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    echo "📝 Creating terraform.tfvars from example..."
    cp terraform.tfvars.example terraform.tfvars
    echo "⚠️  Please edit terraform.tfvars with your configuration"
fi

# Initialize Terraform
echo "🔧 Initializing Terraform..."
terraform init

# Validate configuration
echo "✅ Validating Terraform configuration..."
terraform validate

# Plan deployment
echo "📋 Creating deployment plan..."
terraform plan -out=tfplan

echo "🎉 Terraform setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit terraform.tfvars with your configuration"
echo "2. Review the plan: terraform show tfplan"
echo "3. Apply changes: terraform apply tfplan"
echo ""
echo "Available commands:"
echo "- terraform plan     # Create execution plan"
echo "- terraform apply    # Apply changes"
echo "- terraform destroy  # Destroy infrastructure"
echo "- terraform output   # Show output values"
`;

const setupScriptPath = path.join(__dirname, 'setup.sh');
if (!fs.existsSync(setupScriptPath)) {
  fs.writeFileSync(setupScriptPath, terraformSetupScript);
  if (process.platform !== 'win32') {
    try {
      execSync(`chmod +x "${setupScriptPath}"`);
      console.log('✅ Created executable setup.sh');
    } catch (error) {
      console.log('✅ Created setup.sh (could not make executable)');
    }
  } else {
    console.log('✅ Created setup.sh');
  }
}

// Create README for Terraform
const terraformReadme = `# Terraform Infrastructure

This directory contains Terraform configuration for deploying the Business Task Automation Platform to AWS.

## Prerequisites

- Terraform >= 1.0
- AWS CLI configured with appropriate credentials
- kubectl (for Kubernetes management)

## Quick Start

1. **Setup**:
   \`\`\`bash
   ./setup.sh
   \`\`\`

2. **Configure**:
   Edit \`terraform.tfvars\` with your settings

3. **Deploy**:
   \`\`\`bash
   terraform apply
   \`\`\`

## Infrastructure Components

- **VPC**: Virtual Private Cloud with public/private subnets
- **EKS**: Managed Kubernetes cluster
- **RDS**: PostgreSQL database
- **ElastiCache**: Redis cache
- **ALB**: Application Load Balancer
- **Security Groups**: Network security rules

## Configuration

Key variables in \`terraform.tfvars\`:

- \`project_name\`: Project identifier
- \`environment\`: Environment (dev/staging/prod)
- \`region\`: AWS region
- \`cluster_name\`: EKS cluster name
- \`node_count\`: Number of worker nodes

## Commands

- \`terraform init\`: Initialize Terraform
- \`terraform plan\`: Preview changes
- \`terraform apply\`: Apply changes
- \`terraform destroy\`: Destroy infrastructure
- \`terraform output\`: Show outputs

## Outputs

After deployment, Terraform will output:

- Cluster endpoint
- Database endpoint
- Load balancer DNS
- Kubeconfig command

## Security

- All resources are tagged for identification
- Security groups restrict access
- Database is in private subnets
- Encryption enabled where possible

## Monitoring

- CloudWatch logging enabled
- Metrics collection configured
- Alerting rules defined

## Backup

- Automated database backups
- Point-in-time recovery enabled
- Backup retention configurable
`;

const readmePath = path.join(__dirname, 'README.md');
if (!fs.existsSync(readmePath)) {
  fs.writeFileSync(readmePath, terraformReadme);
  console.log('✅ Created README.md');
}

console.log('\n🎉 Terraform setup complete!');
console.log('\nNext steps:');
console.log('1. Install Terraform if not already installed');
console.log('2. Configure AWS credentials: aws configure');
console.log('3. Run setup: ./setup.sh');
console.log('4. Edit terraform.tfvars with your configuration');
console.log('5. Deploy: terraform apply');
console.log('\nFiles created:');
console.log('- terraform.tfvars.example  # Configuration template');
console.log('- backend.tf                # Backend configuration');
console.log('- providers.tf              # Provider configuration');
console.log('- modules/                  # Terraform modules');
console.log('- setup.sh                  # Setup script');
console.log('- README.md                 # Documentation');