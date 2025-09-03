---
name: "Documentation Sync"
description: "Automatically update documentation when code changes"
trigger: "file_save"
filePattern: "**/*.{ts,tsx,py}"
enabled: true
---

# Documentation Sync Hook

## Overview
This hook automatically updates relevant documentation when code files are modified, ensuring documentation stays in sync with implementation changes.

## Trigger Configuration

**Event**: File Save
**File Patterns**:
- `**/*.ts` - TypeScript implementation files
- `**/*.tsx` - React component files
- `**/*.py` - Python AI/ML scripts

**Excluded Patterns**:
- `**/*.test.{ts,js}` - Test files
- `**/*.spec.{ts,js}` - Specification files
- `**/node_modules/**` - Dependencies

## Actions

### 1. API Documentation Updates
When API endpoints are modified:
- Extract API route definitions and parameters
- Update OpenAPI/Swagger specifications
- Generate updated API documentation
- Validate documentation completeness

### 2. Component Documentation
When React components are updated:
- Extract component props and interfaces
- Update component usage examples
- Generate component documentation
- Update storybook stories if applicable

### 3. AI/ML Documentation
When AI/ML models are modified:
- Update model specifications and parameters
- Document training data requirements
- Update performance benchmarks
- Generate model usage examples

### 4. Architecture Documentation
When core services are modified:
- Update system architecture diagrams
- Document service interactions
- Update deployment configurations
- Refresh technical specifications

## Implementation

### API Documentation Sync
```typescript
// When services/src/api-gateway/routes/*.ts changes
async function updateApiDocs(changedFile: string) {
  const routes = extractRoutes(changedFile);
  const openApiSpec = await loadOpenApiSpec();
  
  for (const route of routes) {
    updateOpenApiPath(openApiSpec, route);
  }
  
  await saveOpenApiSpec(openApiSpec);
  await generateApiDocs();
}
```

### Component Documentation Sync
```typescript
// When client/src/components/*.tsx changes
async function updateComponentDocs(componentFile: string) {
  const component = parseComponent(componentFile);
  const props = extractProps(component);
  
  await updateComponentReadme(component.name, props);
  await generateUsageExamples(component);
  await updateStorybookStories(component);
}
```

### Model Documentation Sync
```python
# When services/src/ai-ml-engine/*.py changes
def update_model_docs(model_file: str):
    model_info = extract_model_info(model_file)
    update_model_spec(model_info)
    generate_training_docs(model_info)
    update_performance_metrics(model_info)
```

## Configuration

```yaml
hook:
  name: "documentation-sync"
  trigger: "file_save"
  
  conditions:
    - filePattern: "services/src/api-gateway/**/*.ts"
      action: "update-api-docs"
      
    - filePattern: "client/src/components/**/*.tsx"
      action: "update-component-docs"
      
    - filePattern: "services/src/ai-ml-engine/**/*.py"
      action: "update-model-docs"
      
    - filePattern: "services/src/shared/**/*.ts"
      action: "update-shared-docs"

  actions:
    - name: "extract-documentation"
      command: "node scripts/extract-docs.js ${changedFile}"
      
    - name: "update-openapi"
      command: "swagger-codegen generate -i docs/api/openapi-spec.yaml"
      condition: "api_changed"
      
    - name: "generate-readme"
      command: "node scripts/generate-readme.js"
      
    - name: "validate-docs"
      command: "markdownlint docs/**/*.md"
```

## Documentation Targets

### API Documentation
- **OpenAPI Specification**: `docs/api/openapi-spec.yaml`
- **API Reference**: `docs/api/README.md`
- **Endpoint Examples**: `docs/api/examples/`

### Component Documentation
- **Component README**: `client/src/components/*/README.md`
- **Props Documentation**: Auto-generated from TypeScript interfaces
- **Usage Examples**: `docs/components/examples/`

### Architecture Documentation
- **System Overview**: `docs/technical/architecture.md`
- **Service Documentation**: `docs/technical/services/`
- **Deployment Guides**: `docs/technical/deployment.md`

### User Documentation
- **User Guides**: `docs/user-guides/`
- **Tutorials**: `docs/support/video-tutorials.md`
- **FAQ Updates**: `docs/support/faq.md`

## Benefits

1. **Always Current**: Documentation automatically reflects code changes
2. **Reduced Maintenance**: Eliminates manual documentation updates
3. **Consistency**: Ensures uniform documentation standards
4. **Developer Productivity**: Developers focus on code, not documentation
5. **Quality Assurance**: Automated validation of documentation completeness

## Usage Examples

### API Endpoint Addition
When adding a new endpoint in `services/src/api-gateway/routes/workflows.ts`:
```typescript
// New endpoint added
router.post('/workflows/:id/execute', executeWorkflow);
```

Hook automatically:
- Updates OpenAPI specification with new endpoint
- Generates request/response examples
- Updates API documentation
- Validates documentation completeness

### Component Props Update
When modifying component props in `client/src/components/WorkflowCard.tsx`:
```typescript
interface WorkflowCardProps {
  workflow: Workflow;
  onExecute: (id: string) => void;
  showStatus?: boolean; // New prop added
}
```

Hook automatically:
- Updates component README with new prop
- Generates usage examples
- Updates TypeScript documentation
- Refreshes component catalog

### Model Parameter Changes
When updating AI model in `services/src/ai-ml-engine/text-classifier.py`:
```python
class TextClassifier:
    def __init__(self, model_path: str, confidence_threshold: float = 0.8):
        # New parameter added
```

Hook automatically:
- Updates model specification documentation
- Generates new usage examples
- Updates training documentation
- Refreshes API documentation

## Customization

### Documentation Templates
```yaml
templates:
  api_endpoint: "docs/templates/api-endpoint.md"
  component: "docs/templates/component.md"
  model: "docs/templates/model.md"
  service: "docs/templates/service.md"
```

### Validation Rules
```yaml
validation:
  required_sections:
    - "Overview"
    - "Parameters"
    - "Examples"
    - "Error Handling"
  
  style_guide: "docs/style-guide.md"
  spell_check: true
  link_validation: true
```

## Troubleshooting

### Common Issues

**Documentation Generation Fails**
- Check file permissions for documentation directories
- Verify template files exist and are valid
- Ensure required tools are installed (swagger-codegen, etc.)

**Incomplete Documentation**
- Review extraction patterns for code parsing
- Check TypeScript compilation for interface extraction
- Validate template completeness

**Performance Issues**
- Limit documentation generation to changed files only
- Use caching for unchanged documentation
- Optimize parsing and generation scripts

### Debugging

Enable verbose logging:
```bash
export KIRO_HOOK_DEBUG=true
export DOC_SYNC_VERBOSE=true
```

View documentation sync logs:
```bash
tail -f .kiro/logs/hooks/documentation-sync.log
```

Validate generated documentation:
```bash
npm run docs:validate
```