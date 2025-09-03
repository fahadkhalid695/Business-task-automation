#!/usr/bin/env python3
"""
AI Model Accuracy and Data Quality Testing Suite
"""

import json
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.model_selection import train_test_split
import requests
import logging
from datetime import datetime
import os
from typing import Dict, List, Tuple, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelAccuracyTester:
    def __init__(self, api_base_url: str = "http://localhost:3000/api/v1"):
        self.api_base_url = api_base_url
        self.results = {
            'model_tests': [],
            'data_quality_tests': [],
            'summary': {}
        }
        
    def authenticate(self) -> str:
        """Authenticate and get access token"""
        response = requests.post(f"{self.api_base_url}/auth/login", json={
            "email": "test@test.com",
            "password": "TestUser123!"
        })
        return response.json()['token']
    
    def test_email_classification_model(self) -> Dict[str, Any]:
        """Test email classification model accuracy"""
        logger.info("Testing email classification model...")
        
        # Load test dataset
        test_emails = self.load_test_emails()
        
        results = {
            'model_name': 'email_classifier',
            'test_count': len(test_emails),
            'predictions': [],
            'actual': [],
            'metrics': {}
        }
        
        token = self.authenticate()
        headers = {'Authorization': f'Bearer {token}'}
        
        for email in test_emails:
            # Get model prediction
            response = requests.post(
                f"{self.api_base_url}/ai/classify-email",
                json={'content': email['content']},
                headers=headers
            )
            
            if response.status_code == 200:
                prediction = response.json()['category']
                results['predictions'].append(prediction)
                results['actual'].append(email['actual_category'])
            else:
                logger.error(f"Failed to classify email: {response.status_code}")
        
        # Calculate metrics
        if results['predictions']:
            results['metrics'] = self.calculate_classification_metrics(
                results['actual'], results['predictions']
            )
        
        self.results['model_tests'].append(results)
        return results
    
    def test_sentiment_analysis_model(self) -> Dict[str, Any]:
        """Test sentiment analysis model accuracy"""
        logger.info("Testing sentiment analysis model...")
        
        test_texts = self.load_sentiment_test_data()
        
        results = {
            'model_name': 'sentiment_analyzer',
            'test_count': len(test_texts),
            'predictions': [],
            'actual': [],
            'metrics': {}
        }
        
        token = self.authenticate()
        headers = {'Authorization': f'Bearer {token}'}
        
        for text_data in test_texts:
            response = requests.post(
                f"{self.api_base_url}/ai/analyze-sentiment",
                json={'text': text_data['text']},
                headers=headers
            )
            
            if response.status_code == 200:
                prediction = response.json()['sentiment']
                results['predictions'].append(prediction)
                results['actual'].append(text_data['actual_sentiment'])
        
        if results['predictions']:
            results['metrics'] = self.calculate_classification_metrics(
                results['actual'], results['predictions']
            )
        
        self.results['model_tests'].append(results)
        return results
    
    def test_document_generation_quality(self) -> Dict[str, Any]:
        """Test document generation quality"""
        logger.info("Testing document generation quality...")
        
        test_prompts = self.load_document_generation_prompts()
        
        results = {
            'model_name': 'document_generator',
            'test_count': len(test_prompts),
            'quality_scores': [],
            'metrics': {}
        }
        
        token = self.authenticate()
        headers = {'Authorization': f'Bearer {token}'}
        
        for prompt in test_prompts:
            response = requests.post(
                f"{self.api_base_url}/ai/generate-document",
                json=prompt,
                headers=headers
            )
            
            if response.status_code == 200:
                generated_content = response.json()['content']
                quality_score = self.evaluate_document_quality(
                    generated_content, prompt['expected_elements']
                )
                results['quality_scores'].append(quality_score)
        
        if results['quality_scores']:
            results['metrics'] = {
                'average_quality': np.mean(results['quality_scores']),
                'min_quality': np.min(results['quality_scores']),
                'max_quality': np.max(results['quality_scores']),
                'std_quality': np.std(results['quality_scores'])
            }
        
        self.results['model_tests'].append(results)
        return results
    
    def test_data_quality(self, dataset_path: str) -> Dict[str, Any]:
        """Test data quality metrics"""
        logger.info(f"Testing data quality for dataset: {dataset_path}")
        
        try:
            df = pd.read_csv(dataset_path)
        except Exception as e:
            logger.error(f"Failed to load dataset: {e}")
            return {}
        
        results = {
            'dataset': dataset_path,
            'total_records': len(df),
            'total_columns': len(df.columns),
            'quality_metrics': {}
        }
        
        # Completeness
        completeness = 1 - (df.isnull().sum().sum() / (len(df) * len(df.columns)))
        results['quality_metrics']['completeness'] = completeness
        
        # Uniqueness (for each column)
        uniqueness_scores = {}
        for col in df.columns:
            if df[col].dtype in ['object', 'string']:
                unique_ratio = df[col].nunique() / len(df)
                uniqueness_scores[col] = unique_ratio
        results['quality_metrics']['uniqueness'] = uniqueness_scores
        
        # Consistency (data type consistency)
        consistency_scores = {}
        for col in df.columns:
            if df[col].dtype == 'object':
                # Check for consistent formatting
                non_null_values = df[col].dropna()
                if len(non_null_values) > 0:
                    # Simple consistency check - all values follow similar pattern
                    consistency_scores[col] = self.check_format_consistency(non_null_values)
        results['quality_metrics']['consistency'] = consistency_scores
        
        # Validity (basic range checks for numeric columns)
        validity_scores = {}
        for col in df.select_dtypes(include=[np.number]).columns:
            # Check for outliers using IQR method
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            valid_count = len(df[(df[col] >= lower_bound) & (df[col] <= upper_bound)])
            validity_scores[col] = valid_count / len(df)
        results['quality_metrics']['validity'] = validity_scores
        
        # Overall quality score
        overall_quality = np.mean([
            completeness,
            np.mean(list(uniqueness_scores.values())) if uniqueness_scores else 1.0,
            np.mean(list(consistency_scores.values())) if consistency_scores else 1.0,
            np.mean(list(validity_scores.values())) if validity_scores else 1.0
        ])
        results['quality_metrics']['overall_quality'] = overall_quality
        
        self.results['data_quality_tests'].append(results)
        return results
    
    def calculate_classification_metrics(self, actual: List, predicted: List) -> Dict[str, float]:
        """Calculate classification metrics"""
        return {
            'accuracy': accuracy_score(actual, predicted),
            'precision': precision_score(actual, predicted, average='weighted', zero_division=0),
            'recall': recall_score(actual, predicted, average='weighted', zero_division=0),
            'f1_score': f1_score(actual, predicted, average='weighted', zero_division=0)
        }
    
    def evaluate_document_quality(self, content: str, expected_elements: List[str]) -> float:
        """Evaluate generated document quality"""
        score = 0.0
        total_elements = len(expected_elements)
        
        if total_elements == 0:
            return 1.0
        
        for element in expected_elements:
            if element.lower() in content.lower():
                score += 1.0
        
        # Additional quality checks
        if len(content) > 100:  # Minimum length
            score += 0.1
        if content.count('.') > 2:  # Proper sentence structure
            score += 0.1
        if not any(char.isdigit() for char in content[:50]):  # Not just numbers
            score += 0.1
        
        return min(score / total_elements, 1.0)
    
    def check_format_consistency(self, values: pd.Series) -> float:
        """Check format consistency for string values"""
        if len(values) == 0:
            return 1.0
        
        # Simple consistency check - similar length and character patterns
        lengths = values.str.len()
        length_consistency = 1 - (lengths.std() / lengths.mean()) if lengths.mean() > 0 else 0
        
        return max(0, min(1, length_consistency))
    
    def load_test_emails(self) -> List[Dict]:
        """Load test email dataset"""
        # Mock test data - in real implementation, load from file
        return [
            {
                'content': 'Urgent: Please review the quarterly report by EOD',
                'actual_category': 'urgent'
            },
            {
                'content': 'Thank you for your purchase. Your order will be shipped soon.',
                'actual_category': 'normal'
            },
            {
                'content': 'Newsletter: Latest updates from our company',
                'actual_category': 'low'
            }
        ]
    
    def load_sentiment_test_data(self) -> List[Dict]:
        """Load sentiment analysis test data"""
        return [
            {
                'text': 'I am very happy with the service!',
                'actual_sentiment': 'positive'
            },
            {
                'text': 'This is terrible and disappointing.',
                'actual_sentiment': 'negative'
            },
            {
                'text': 'The weather is okay today.',
                'actual_sentiment': 'neutral'
            }
        ]
    
    def load_document_generation_prompts(self) -> List[Dict]:
        """Load document generation test prompts"""
        return [
            {
                'type': 'meeting_notes',
                'parameters': {
                    'meeting_title': 'Weekly Team Meeting',
                    'date': '2024-01-15',
                    'attendees': ['John Doe', 'Jane Smith']
                },
                'expected_elements': ['meeting_title', 'date', 'attendees', 'agenda', 'action_items']
            }
        ]
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all model and data quality tests"""
        logger.info("Starting comprehensive model and data quality tests...")
        
        # Model accuracy tests
        self.test_email_classification_model()
        self.test_sentiment_analysis_model()
        self.test_document_generation_quality()
        
        # Data quality tests
        test_datasets = [
            'testing/data-quality/datasets/sample-sales-data.csv',
            'testing/data-quality/datasets/sample-user-data.csv',
            'testing/data-quality/datasets/sample-email-data.csv'
        ]
        
        for dataset in test_datasets:
            if os.path.exists(dataset):
                self.test_data_quality(dataset)
        
        # Generate summary
        self.generate_summary()
        
        return self.results
    
    def generate_summary(self):
        """Generate test summary"""
        model_accuracies = []
        data_qualities = []
        
        for test in self.results['model_tests']:
            if 'accuracy' in test.get('metrics', {}):
                model_accuracies.append(test['metrics']['accuracy'])
        
        for test in self.results['data_quality_tests']:
            if 'overall_quality' in test.get('quality_metrics', {}):
                data_qualities.append(test['quality_metrics']['overall_quality'])
        
        self.results['summary'] = {
            'timestamp': datetime.now().isoformat(),
            'total_model_tests': len(self.results['model_tests']),
            'total_data_quality_tests': len(self.results['data_quality_tests']),
            'average_model_accuracy': np.mean(model_accuracies) if model_accuracies else 0,
            'average_data_quality': np.mean(data_qualities) if data_qualities else 0,
            'passed_accuracy_threshold': sum(1 for acc in model_accuracies if acc >= 0.85),
            'passed_quality_threshold': sum(1 for qual in data_qualities if qual >= 0.90)
        }
    
    def save_results(self, output_path: str = 'testing/data-quality/reports/model-accuracy-report.json'):
        """Save test results to file"""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        
        logger.info(f"Results saved to {output_path}")

if __name__ == "__main__":
    tester = ModelAccuracyTester()
    results = tester.run_all_tests()
    tester.save_results()
    
    print("\n📊 Model Accuracy & Data Quality Test Summary:")
    print(f"   Model Tests: {results['summary']['total_model_tests']}")
    print(f"   Data Quality Tests: {results['summary']['total_data_quality_tests']}")
    print(f"   Average Model Accuracy: {results['summary']['average_model_accuracy']:.3f}")
    print(f"   Average Data Quality: {results['summary']['average_data_quality']:.3f}")