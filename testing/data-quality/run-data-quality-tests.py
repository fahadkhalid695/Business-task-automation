#!/usr/bin/env python3
"""
Comprehensive Data Quality and AI Model Accuracy Testing Suite
"""

import json
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.model_selection import cross_val_score
import requests
import os
import sys
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DataQualityTester:
    def __init__(self, config_path='testing/configs/test-config.json'):
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        self.api_url = self.config['environments']['development']['apiUrl']
        self.thresholds = self.config['thresholds']['dataQuality']
        self.reports_dir = 'testing/data-quality/reports'
        
        # Ensure reports directory exists
        os.makedirs(self.reports_dir, exist_ok=True)
        
        # Authentication
        self.token = self._authenticate()

    def _authenticate(self):
        """Authenticate with the API"""
        auth_data = {
            'email': self.config['testData']['users']['admin']['email'],
            'password': self.config['testData']['users']['admin']['password']
        }
        
        response = requests.post(f"{self.api_url}/auth/login", json=auth_data)
        if response.status_code == 200:
            return response.json()['token']
        else:
            raise Exception(f"Authentication failed: {response.text}")

    def run_all_tests(self):
        """Run all data quality and AI model tests"""
        logger.info("🧪 Starting comprehensive data quality and AI model testing...")
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'data_quality': self.test_data_quality(),
            'ai_models': self.test_ai_model_accuracy(),
            'data_pipeline': self.test_data_pipeline_integrity(),
            'model_drift': self.test_model_drift_detection(),
            'data_validation': self.test_data_validation_rules()
        }
        
        # Generate comprehensive report
        self._generate_report(results)
        
        # Check if all tests pass thresholds
        overall_status = self._evaluate_overall_status(results)
        
        if overall_status:
            logger.info("✅ All data quality and AI model tests passed!")
            return True
        else:
            logger.error("❌ Some tests failed to meet quality thresholds")
            return False

    def test_data_quality(self):
        """Test data quality metrics"""
        logger.info("Testing data quality metrics...")
        
        # Load test datasets
        datasets = self._load_test_datasets()
        results = {}
        
        for dataset_name, dataset in datasets.items():
            logger.info(f"Analyzing dataset: {dataset_name}")
            
            quality_metrics = {
                'completeness': self._calculate_completeness(dataset),
                'accuracy': self._calculate_accuracy(dataset),
                'consistency': self._calculate_consistency(dataset),
                'validity': self._calculate_validity(dataset),
                'uniqueness': self._calculate_uniqueness(dataset),
                'timeliness': self._calculate_timeliness(dataset)
            }
            
            results[dataset_name] = {
                'metrics': quality_metrics,
                'passed': all(
                    metric >= self.thresholds.get(metric_name, 0.9)
                    for metric_name, metric in quality_metrics.items()
                )
            }
        
        return results

    def test_ai_model_accuracy(self):
        """Test AI model accuracy and performance"""
        logger.info("Testing AI model accuracy...")
        
        models = self._get_deployed_models()
        results = {}
        
        for model in models:
            logger.info(f"Testing model: {model['name']}")
            
            # Load validation dataset for this model
            validation_data = self._load_validation_dataset(model['type'])
            
            # Get model predictions
            predictions = self._get_model_predictions(model['id'], validation_data)
            
            # Calculate metrics
            accuracy_metrics = self._calculate_model_metrics(
                validation_data['true_labels'],
                predictions
            )
            
            # Performance benchmarks
            performance_metrics = self._benchmark_model_performance(model['id'])
            
            results[model['name']] = {
                'accuracy_metrics': accuracy_metrics,
                'performance_metrics': performance_metrics,
                'passed': accuracy_metrics['accuracy'] >= self.thresholds['accuracy']
            }
        
        return results

    def test_data_pipeline_integrity(self):
        """Test data pipeline integrity and transformations"""
        logger.info("Testing data pipeline integrity...")
        
        # Test data ingestion
        ingestion_results = self._test_data_ingestion()
        
        # Test data transformations
        transformation_results = self._test_data_transformations()
        
        # Test data output quality
        output_results = self._test_data_output_quality()
        
        return {
            'ingestion': ingestion_results,
            'transformations': transformation_results,
            'output': output_results,
            'passed': all([
                ingestion_results['passed'],
                transformation_results['passed'],
                output_results['passed']
            ])
        }

    def test_model_drift_detection(self):
        """Test model drift detection and monitoring"""
        logger.info("Testing model drift detection...")
        
        models = self._get_deployed_models()
        results = {}
        
        for model in models:
            # Get recent prediction data
            recent_data = self._get_recent_model_data(model['id'])
            
            # Calculate drift metrics
            drift_metrics = self._calculate_drift_metrics(model['id'], recent_data)
            
            results[model['name']] = {
                'drift_score': drift_metrics['drift_score'],
                'feature_drift': drift_metrics['feature_drift'],
                'prediction_drift': drift_metrics['prediction_drift'],
                'alert_triggered': drift_metrics['drift_score'] > 0.1,
                'passed': drift_metrics['drift_score'] <= 0.1
            }
        
        return results

    def test_data_validation_rules(self):
        """Test data validation rules and constraints"""
        logger.info("Testing data validation rules...")
        
        validation_rules = self._get_validation_rules()
        results = {}
        
        for rule_name, rule in validation_rules.items():
            # Apply validation rule to test data
            test_data = self._load_test_data_for_rule(rule)
            validation_result = self._apply_validation_rule(rule, test_data)
            
            results[rule_name] = {
                'rule_type': rule['type'],
                'violations': validation_result['violations'],
                'violation_rate': validation_result['violation_rate'],
                'passed': validation_result['violation_rate'] <= 0.05  # 5% threshold
            }
        
        return results

    def _load_test_datasets(self):
        """Load test datasets for quality analysis"""
        datasets = {}
        
        # Load customer data
        datasets['customers'] = pd.read_csv('testing/data-quality/datasets/customers.csv')
        
        # Load transaction data
        datasets['transactions'] = pd.read_csv('testing/data-quality/datasets/transactions.csv')
        
        # Load product data
        datasets['products'] = pd.read_csv('testing/data-quality/datasets/products.csv')
        
        return datasets

    def _calculate_completeness(self, dataset):
        """Calculate data completeness score"""
        total_cells = dataset.size
        missing_cells = dataset.isnull().sum().sum()
        return (total_cells - missing_cells) / total_cells

    def _calculate_accuracy(self, dataset):
        """Calculate data accuracy score"""
        # Implement domain-specific accuracy checks
        accuracy_checks = []
        
        # Email format validation
        if 'email' in dataset.columns:
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            valid_emails = dataset['email'].str.match(email_pattern, na=False)
            accuracy_checks.append(valid_emails.mean())
        
        # Phone number validation
        if 'phone' in dataset.columns:
            phone_pattern = r'^\+?1?[0-9]{10,15}$'
            valid_phones = dataset['phone'].str.match(phone_pattern, na=False)
            accuracy_checks.append(valid_phones.mean())
        
        return np.mean(accuracy_checks) if accuracy_checks else 1.0

    def _calculate_consistency(self, dataset):
        """Calculate data consistency score"""
        consistency_checks = []
        
        # Check for duplicate records
        if len(dataset) > 0:
            duplicate_rate = dataset.duplicated().mean()
            consistency_checks.append(1 - duplicate_rate)
        
        # Check for consistent formatting
        for column in dataset.select_dtypes(include=['object']).columns:
            if len(dataset[column].dropna()) > 0:
                # Check case consistency
                mixed_case_rate = (
                    dataset[column].str.islower() | 
                    dataset[column].str.isupper()
                ).mean()
                consistency_checks.append(mixed_case_rate)
        
        return np.mean(consistency_checks) if consistency_checks else 1.0

    def _calculate_validity(self, dataset):
        """Calculate data validity score"""
        validity_checks = []
        
        # Check data types
        for column in dataset.columns:
            if dataset[column].dtype == 'object':
                # String length validation
                if 'name' in column.lower():
                    valid_length = (dataset[column].str.len() >= 2) & (dataset[column].str.len() <= 100)
                    validity_checks.append(valid_length.mean())
            elif np.issubdtype(dataset[column].dtype, np.number):
                # Numeric range validation
                if 'age' in column.lower():
                    valid_range = (dataset[column] >= 0) & (dataset[column] <= 150)
                    validity_checks.append(valid_range.mean())
        
        return np.mean(validity_checks) if validity_checks else 1.0

    def _calculate_uniqueness(self, dataset):
        """Calculate data uniqueness score"""
        if len(dataset) == 0:
            return 1.0
        
        unique_rate = len(dataset.drop_duplicates()) / len(dataset)
        return unique_rate

    def _calculate_timeliness(self, dataset):
        """Calculate data timeliness score"""
        timeliness_checks = []
        
        # Check for recent timestamps
        for column in dataset.columns:
            if 'date' in column.lower() or 'time' in column.lower():
                try:
                    dates = pd.to_datetime(dataset[column])
                    recent_threshold = pd.Timestamp.now() - pd.Timedelta(days=30)
                    recent_rate = (dates >= recent_threshold).mean()
                    timeliness_checks.append(recent_rate)
                except:
                    continue
        
        return np.mean(timeliness_checks) if timeliness_checks else 1.0

    def _get_deployed_models(self):
        """Get list of deployed AI models"""
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.get(f"{self.api_url}/ai/models", headers=headers)
        
        if response.status_code == 200:
            return response.json()
        else:
            return []

    def _load_validation_dataset(self, model_type):
        """Load validation dataset for specific model type"""
        dataset_path = f'testing/data-quality/datasets/validation_{model_type}.json'
        
        if os.path.exists(dataset_path):
            with open(dataset_path, 'r') as f:
                return json.load(f)
        else:
            # Generate synthetic validation data
            return self._generate_synthetic_validation_data(model_type)

    def _generate_synthetic_validation_data(self, model_type):
        """Generate synthetic validation data for testing"""
        if model_type == 'classification':
            return {
                'inputs': [f"Test document {i}" for i in range(100)],
                'true_labels': np.random.choice(['positive', 'negative'], 100).tolist()
            }
        elif model_type == 'regression':
            return {
                'inputs': np.random.randn(100, 5).tolist(),
                'true_labels': np.random.randn(100).tolist()
            }
        else:
            return {'inputs': [], 'true_labels': []}

    def _get_model_predictions(self, model_id, validation_data):
        """Get model predictions for validation data"""
        headers = {'Authorization': f'Bearer {self.token}'}
        predictions = []
        
        for input_data in validation_data['inputs']:
            response = requests.post(
                f"{self.api_url}/ai/inference",
                json={'model_id': model_id, 'input': input_data},
                headers=headers
            )
            
            if response.status_code == 200:
                predictions.append(response.json()['prediction'])
            else:
                predictions.append(None)
        
        return predictions

    def _calculate_model_metrics(self, true_labels, predictions):
        """Calculate model accuracy metrics"""
        # Filter out None predictions
        valid_pairs = [(t, p) for t, p in zip(true_labels, predictions) if p is not None]
        
        if not valid_pairs:
            return {'accuracy': 0, 'precision': 0, 'recall': 0, 'f1': 0}
        
        true_vals, pred_vals = zip(*valid_pairs)
        
        # Convert to numeric if needed
        if isinstance(true_vals[0], str):
            label_map = {label: i for i, label in enumerate(set(true_vals))}
            true_numeric = [label_map[label] for label in true_vals]
            pred_numeric = [label_map.get(pred, -1) for pred in pred_vals]
        else:
            true_numeric = true_vals
            pred_numeric = pred_vals
        
        return {
            'accuracy': accuracy_score(true_numeric, pred_numeric),
            'precision': precision_score(true_numeric, pred_numeric, average='weighted', zero_division=0),
            'recall': recall_score(true_numeric, pred_numeric, average='weighted', zero_division=0),
            'f1': f1_score(true_numeric, pred_numeric, average='weighted', zero_division=0)
        }

    def _benchmark_model_performance(self, model_id):
        """Benchmark model performance metrics"""
        # Simulate performance testing
        return {
            'inference_time_ms': np.random.uniform(50, 200),
            'throughput_rps': np.random.uniform(100, 1000),
            'memory_usage_mb': np.random.uniform(100, 500)
        }

    def _generate_report(self, results):
        """Generate comprehensive test report"""
        report_path = os.path.join(self.reports_dir, f'data_quality_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        
        with open(report_path, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        logger.info(f"📊 Data quality report generated: {report_path}")

    def _evaluate_overall_status(self, results):
        """Evaluate overall test status"""
        all_passed = True
        
        for category, category_results in results.items():
            if isinstance(category_results, dict) and 'passed' in category_results:
                if not category_results['passed']:
                    all_passed = False
                    logger.warning(f"❌ {category} tests failed")
            elif isinstance(category_results, dict):
                for test_name, test_result in category_results.items():
                    if isinstance(test_result, dict) and 'passed' in test_result:
                        if not test_result['passed']:
                            all_passed = False
                            logger.warning(f"❌ {category}.{test_name} test failed")
        
        return all_passed

if __name__ == "__main__":
    tester = DataQualityTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)