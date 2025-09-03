# AI/ML Engine

The AI/ML Engine is a comprehensive service for managing and executing AI/ML operations within the Business Task Automation System. It provides a unified interface for various AI models and services, with built-in caching, monitoring, and error handling.

## Features

- **Model Management**: Load, unload, and manage AI models with versioning support
- **Multi-Provider Support**: Currently supports OpenAI with extensible architecture for other providers
- **Inference Engine**: Unified interface for text generation, classification, and translation
- **Performance Monitoring**: Track model performance, response times, and usage metrics
- **Caching**: Redis-based caching for improved performance
- **Error Handling**: Comprehensive error handling with retry logic and graceful degradation
- **Batch Processing**: Efficient batch inference for high-volume operations

## Architecture

```
AI/ML Engine
├── ModelManager          # Model lifecycle management
├── InferenceEngine       # Unified inference interface
├── Services/
│   └── OpenAIService    # OpenAI API integration
├── Types/               # TypeScript type definitions
└── Examples/            # Usage examples
```

## Quick Start

### 1. Environment Setup

```bash
# Required environment variables
OPENAI_API_KEY=your_openai_api_key
REDIS_URL=redis://localhost:6379
```

### 2. Basic Usage

```typescript
import { ModelManager } from './ModelManager';
import { InferenceEngine } from './InferenceEngine';

// Initialize components
const modelManager = new ModelManager();
const inferenceEngine = new InferenceEngine(modelManager);

// Load default models
await modelManager.initializeDefaultModels();

// Generate text
const result = await inferenceEngine.generateText(
  "Write a professional email response",
  "openai-gpt-3.5"
);

console.log(result.output);
```

## API Reference

### ModelManager

#### Methods

- `loadModel(modelId: string)`: Load a model into memory
- `unloadModel(modelId: string)`: Unload a model from memory
- `getModel(modelId: string)`: Get a loaded model instance
- `listModels()`: List all available model configurations
- `getLoadedModels()`: Get list of currently loaded model IDs
- `updateMetrics(modelId, responseTime, success, tokensUsed)`: Update model performance metrics
- `checkModelHealth(modelId: string)`: Check if a model is healthy
- `cleanupUnusedModels(maxIdleTime?: number)`: Remove unused models from memory

### InferenceEngine

#### Methods

- `generateText(prompt, modelType?, options?)`: Generate text using AI models
- `classify(text, modelType?, categories?)`: Classify text into categories
- `translate(text, sourceLang, targetLang, modelType?)`: Translate text between languages
- `analyzeSentiment(text, modelType?)`: Analyze sentiment of text
- `extractInformation(text, extractionType, modelType?)`: Extract entities, keywords, summaries, or action items
- `batchInference(requests)`: Process multiple inference requests in batch

## Model Types

### Available Models

1. **openai-gpt-3.5**: General-purpose text generation
2. **openai-gpt-4**: Advanced text generation and analysis
3. **openai-classification**: Text classification and sentiment analysis
4. **openai-translation**: Multilingual translation

### Model Configuration

```typescript
interface ModelConfig {
  id: string;
  name: string;
  type: ModelType;
  provider: string;
  version: string;
  endpoint?: string;
  maxTokens?: number;
  costPerToken?: number;
  isActive: boolean;
  capabilities: string[];
}
```

## Usage Examples

### Email Processing

```typescript
// Classify and process an email
const emailResult = await inferenceEngine.classify(
  emailContent,
  'openai-classification',
  ['urgent', 'normal', 'low', 'spam']
);

// Generate response for urgent emails
if (emailResult.output === 'urgent') {
  const response = await inferenceEngine.generateText(
    `Generate a professional response to: "${emailContent}"`,
    'openai-gpt-3.5'
  );
}
```

### Document Analysis

```typescript
// Extract key information from documents
const summary = await inferenceEngine.extractInformation(
  documentContent,
  'summary'
);

const entities = await inferenceEngine.extractInformation(
  documentContent,
  'entities'
);

const actionItems = await inferenceEngine.extractInformation(
  documentContent,
  'action_items'
);
```

### Multilingual Support

```typescript
// Translate customer inquiry
const translation = await inferenceEngine.translate(
  customerMessage,
  'es',  // Spanish
  'en'   // English
);

// Process in English and translate response back
const response = await inferenceEngine.generateText(
  `Respond to: ${translation.output}`
);

const translatedResponse = await inferenceEngine.translate(
  response.output,
  'en',
  'es'
);
```

### Batch Processing

```typescript
// Process multiple reviews for sentiment analysis
const batchRequests = reviews.map(review => ({
  input: review,
  type: 'classification',
  modelType: 'openai-classification',
  options: { categories: ['positive', 'negative', 'neutral'] }
}));

const results = await inferenceEngine.batchInference(batchRequests);
```

## Performance Monitoring

### Metrics Tracked

- Total requests per model
- Success/failure rates
- Average response times
- Token usage and costs
- Model health status

### Accessing Metrics

```typescript
// Get metrics for a specific model
const metrics = modelManager.getMetrics('openai-gpt-3.5');

// Get all metrics
const allMetrics = modelManager.getAllMetrics();

// Check model health
const isHealthy = await modelManager.checkModelHealth('openai-gpt-3.5');
```

## Error Handling

The AI/ML Engine includes comprehensive error handling:

- **Network Errors**: Automatic retry with exponential backoff
- **Rate Limiting**: Graceful handling of API rate limits
- **Model Failures**: Fallback to alternative models when available
- **Validation Errors**: Clear error messages for invalid inputs

## Caching

Redis-based caching is used for:

- Model metadata and configurations
- Frequently accessed inference results
- Performance metrics

## Testing

Run the test suite:

```bash
npm test -- --testPathPattern="ai-ml-engine"
```

### Test Coverage

- Unit tests for all core components
- Integration tests for external services
- Mock implementations for testing without API keys
- Performance and load testing scenarios

## Configuration

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_api_key

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Service Configuration
AI_ML_ENGINE_PORT=3003
LOG_LEVEL=info
NODE_ENV=development
```

### Model Configuration

Models can be configured by modifying the `initializeModelConfigs()` method in `ModelManager.ts`.

## Extending the Engine

### Adding New Providers

1. Create a new service class (e.g., `HuggingFaceService.ts`)
2. Implement the required inference methods
3. Update the `InferenceEngine` to support the new provider
4. Add model configurations for the new provider

### Adding New Model Types

1. Add the new type to the `ModelType` enum
2. Implement specific handling in the `InferenceEngine`
3. Create appropriate test cases
4. Update documentation

## Troubleshooting

### Common Issues

1. **API Key Not Found**: Ensure `OPENAI_API_KEY` is set in environment variables
2. **Redis Connection Failed**: Check Redis server status and connection URL
3. **Model Load Failures**: Verify model configurations and provider availability
4. **High Response Times**: Check model health and consider scaling or caching

### Debugging

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

### Health Checks

The service provides health check endpoints:

```bash
GET /health
```

Returns service status and loaded models information.

## Contributing

1. Follow TypeScript best practices
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure error handling for all edge cases
5. Monitor performance impact of changes

## License

This AI/ML Engine is part of the Business Task Automation System and follows the same licensing terms.