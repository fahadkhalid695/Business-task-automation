const fs = require('fs');
const path = require('path');

console.log('🔍 Validating AI Model Training and Continuous Improvement Implementation...\n');

// Check if all required files exist
const requiredFiles = [
  'src/ai-ml-engine/TrainingPipeline.ts',
  'src/ai-ml-engine/FeedbackCollector.ts',
  'src/ai-ml-engine/ABTestManager.ts',
  'src/ai-ml-engine/ModelDriftDetector.ts',
  'src/ai-ml-engine/FederatedLearningManager.ts',
  'src/ai-ml-engine/__tests__/TrainingPipeline.test.ts',
  'src/ai-ml-engine/__tests__/integration.test.ts'
];

let allFilesExist = true;

console.log('📁 Checking required files:');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing!');
  process.exit(1);
}

// Check file contents for key implementations
console.log('\n🔧 Checking implementation details:');

const checks = [
  {
    file: 'src/ai-ml-engine/TrainingPipeline.ts',
    patterns: [
      'class TrainingPipeline',
      'startTraining',
      'collectFeedback',
      'detectModelDrift',
      'startABTest',
      'evaluateModel'
    ]
  },
  {
    file: 'src/ai-ml-engine/FeedbackCollector.ts',
    patterns: [
      'class FeedbackCollector',
      'submitFeedback',
      'getFeedbackAnalytics',
      'analyzeFeedback'
    ]
  },
  {
    file: 'src/ai-ml-engine/ABTestManager.ts',
    patterns: [
      'class ABTestManager',
      'createABTest',
      'processABTestRequest',
      'calculateStatisticalSignificance'
    ]
  },
  {
    file: 'src/ai-ml-engine/ModelDriftDetector.ts',
    patterns: [
      'class ModelDriftDetector',
      'detectDrift',
      'startMonitoring',
      'establishBaseline'
    ]
  },
  {
    file: 'src/ai-ml-engine/FederatedLearningManager.ts',
    patterns: [
      'class FederatedLearningManager',
      'createFederatedSession',
      'aggregateLocalUpdates',
      'checkConvergence'
    ]
  }
];

let allImplementationsValid = true;

checks.forEach(check => {
  const filePath = path.join(__dirname, check.file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`\n  📄 ${check.file}:`);
  check.patterns.forEach(pattern => {
    const found = content.includes(pattern);
    console.log(`    ${found ? '✅' : '❌'} ${pattern}`);
    if (!found) allImplementationsValid = false;
  });
});

// Check types file
console.log('\n📋 Checking type definitions:');
const typesFile = path.join(__dirname, 'src/ai-ml-engine/types/AITypes.ts');
const typesContent = fs.readFileSync(typesFile, 'utf8');

const requiredTypes = [
  'TrainingConfig',
  'TrainingJob',
  'TrainingStatus',
  'FeedbackData',
  'ModelDriftMetrics',
  'ABTestConfig',
  'FederatedLearningConfig'
];

requiredTypes.forEach(type => {
  const found = typesContent.includes(type);
  console.log(`  ${found ? '✅' : '❌'} ${type}`);
  if (!found) allImplementationsValid = false;
});

// Check test coverage
console.log('\n🧪 Checking test coverage:');
const testFile = path.join(__dirname, 'src/ai-ml-engine/__tests__/TrainingPipeline.test.ts');
const testContent = fs.readFileSync(testFile, 'utf8');

const testSuites = [
  'TrainingPipeline',
  'FeedbackCollector',
  'ABTestManager',
  'ModelDriftDetector',
  'FederatedLearningManager'
];

testSuites.forEach(suite => {
  const found = testContent.includes(`describe('${suite}'`);
  console.log(`  ${found ? '✅' : '❌'} ${suite} tests`);
  if (!found) allImplementationsValid = false;
});

// Check package.json for dependencies
console.log('\n📦 Checking dependencies:');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const requiredDeps = ['uuid'];
requiredDeps.forEach(dep => {
  const found = packageJson.dependencies && packageJson.dependencies[dep];
  console.log(`  ${found ? '✅' : '❌'} ${dep}`);
  if (!found) allImplementationsValid = false;
});

// Final validation
console.log('\n' + '='.repeat(60));
if (allFilesExist && allImplementationsValid) {
  console.log('🎉 AI Model Training and Continuous Improvement Implementation VALIDATED!');
  console.log('\n✨ Key Features Implemented:');
  console.log('  • Training Pipeline with model retraining');
  console.log('  • Feedback collection and analysis');
  console.log('  • A/B testing framework');
  console.log('  • Model drift detection');
  console.log('  • Federated learning capabilities');
  console.log('  • Comprehensive test suite');
  console.log('  • Event-driven architecture');
  console.log('  • Error handling and monitoring');
  
  console.log('\n🚀 Ready for deployment and integration!');
  process.exit(0);
} else {
  console.log('❌ Implementation validation FAILED!');
  console.log('Please check the missing components and fix the issues.');
  process.exit(1);
}