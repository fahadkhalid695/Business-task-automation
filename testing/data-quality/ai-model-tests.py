#!/usr/bin/env python3
"""
AI Model Quality and Accuracy Testing Suite
Tests for data quality, model accuracy, and AI service reliability
"""

import pandas as pd
import numpy as np
import json
import requests
import time
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.model_selection import train_test_split
import logging
from typing import Dict, List, Any, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIModelTestSuite:
    def __init__(self, api_base_url: str = 'http://localhost:3000/api'):
        self.api_base_url = api_base_url
        self.auth_token = None
        self.test_results = {}
        
    def authenticate(self):
        """Authenticate with the API"""
        try:
            response = requests.post(f"{self.api_base_url}/auth/login", json={
                'email': 'ai-test@example.com',
                'password': 'TestPassword123!'
            })
            
            if response.status_code == 200:
                self.auth_token = response.json().get('token')
                logger.info("Authentication successful")
            else:
                logger.error("Authentication failed")
                
        except Exception as e:
            logger.error(f"Authentication error: {e}")
    
    def get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication"""
        return {
            'Authorization': f'Bearer {self.auth_token}',
            'Content-Type': 'application/json'
        } if self.auth_token else {'Content-Type': 'application/json'}
    
    def test_data_quality_validation(self) -> Dict[str, Any]:
        """Test data quality validation algorithms"""
        logger.info("Testing data quality validation...")
        
        # Generate test datasets with known quality issues
        test_datasets = {
            'clean_data': pd.DataFrame({
                'id': range(1000),
                'name': [f'Record {i}' for i in range(1000)],
                'value': np.random.normal(100, 15, 1000),
                'category': np.random.choice(['A', 'B', 'C'], 1000)
            }),
            'missing_data': pd.DataFrame({
                'id': range(1000),
                'name': [f'Record {i}' if i % 10 != 0 else None for i in range(1000)],
                'value': [np.random.normal(100, 15) if i % 15 != 0 else None for i in range(1000)],
                'category': np.random.choice(['A', 'B', 'C'], 1000)
            }),
            'duplicate_data': pd.DataFrame({
                'id': [i // 2 for i in range(1000)],  # Creates duplicates
                'name': [f'Record {i // 2}' for i in range(1000)],
                'value': np.random.normal(100, 15, 1000),
                'category': np.random.choice(['A', 'B', 'C'], 1000)
            }),
            'outlier_data': pd.DataFrame({
                'id': range(1000),
                'name': [f'Record {i}' for i in range(1000)],
                'value': [np.random.normal(100, 15) if i % 50 != 0 else np.random.normal(1000, 50) for i in range(1000)],
                'category': np.random.choice(['A', 'B', 'C'], 1000)
            })
        }
        
        results = {}
        
        for dataset_name, dataset in test_datasets.items():
            try:
                # Upload dataset for quality analysis
                response = requests.post(
                    f"{self.api_base_url}/data/quality-check",
                    json={'data': dataset.to_dict('records')},
                    headers=self.get_headers()
                )
                
                if response.status_code == 200:
                    quality_report = response.json()
                    
                    # Validate quality metrics
                    expected_scores = {
                        'clean_data': {'completeness': 1.0, 'uniqueness': 1.0, 'validity': 1.0},
                        'missing_data': {'completeness': 0.85, 'uniqueness': 1.0, 'validity': 0.9},
                        'duplicate_data': {'completeness': 1.0, 'uniqueness': 0.5, 'validity': 1.0},
                        'outlier_data': {'completeness': 1.0, 'uniqueness': 1.0, 'validity': 0.95}
                    }
                    
                    actual_scores = quality_report.get('quality_scores', {})
                    expected = expected_scores.get(dataset_name, {})
                    
                    accuracy = all(
                        abs(actual_scores.get(metric, 0) - expected_value) < 0.1
                        for metric, expected_value in expected.items()
                    )
                    
                    results[dataset_name] = {
                        'status': 'passed' if accuracy else 'failed',
                        'expected_scores': expected,
                        'actual_scores': actual_scores,
                        'accuracy': accuracy
                    }
                else:
                    results[dataset_name] = {
                        'status': 'error',
                        'error': f"API returned {response.status_code}"
                    }
                    
            except Exception as e:
                results[dataset_name] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        return results
    
    def test_text_classification_accuracy(self) -> Dict[str, Any]:
        """Test text classification model accuracy"""
        logger.info("Testing text classification accuracy...")
        
        # Generate test data for email classification
        test_emails = [
            ("Urgent: Please review the quarterly report", "urgent"),
            ("Meeting scheduled for tomorrow at 2 PM", "meeting"),
            ("Invoice #12345 is now due", "invoice"),
            ("Thank you for your purchase", "confirmation"),
            ("Your password has been reset", "security"),
            ("Weekly newsletter - Industry updates", "newsletter"),
            ("Action required: Approve expense report", "urgent"),
            ("Reminder: Team meeting in conference room A", "meeting"),
            ("Payment confirmation for order #67890", "confirmation"),
            ("Security alert: Unusual login detected", "security")
        ] * 10  # Repeat for more test data
        
        predictions = []
        actual_labels = []
        
        for email_text, true_label in test_emails:
            try:
                response = requests.post(
                    f"{self.api_base_url}/ai/classify-text",
                    json={'text': email_text, 'model': 'email-classifier'},
                    headers=self.get_headers()
                )
                
                if response.status_code == 200:
                    prediction = response.json().get('classification')
                    predictions.append(prediction)
                    actual_labels.append(true_label)
                else:
                    logger.error(f"Classification failed for: {email_text}")
                    
            except Exception as e:
                logger.error(f"Error classifying text: {e}")
        
        if predictions and actual_labels:
            accuracy = accuracy_score(actual_labels, predictions)
            precision = precision_score(actual_labels, predictions, average='weighted')
            recall = recall_score(actual_labels, predictions, average='weighted')
            f1 = f1_score(actual_labels, predictions, average='weighted')
            
            return {
                'model': 'email-classifier',
                'test_samples': len(predictions),
                'accuracy': accuracy,
                'precision': precision,
                'recall': recall,
                'f1_score': f1,
                'passed': accuracy >= 0.85,  # 85% accuracy threshold
                'confusion_matrix': self._calculate_confusion_matrix(actual_labels, predictions)
            }
        else:
            return {
                'model': 'email-classifier',
                'status': 'error',
                'error': 'No predictions generated'
            }
    
    def test_sentiment_analysis_accuracy(self) -> Dict[str, Any]:
        """Test sentiment analysis model accuracy"""
        logger.info("Testing sentiment analysis accuracy...")
        
        # Test data with known sentiments
        test_texts = [
            ("I love this product! It's amazing!", "positive"),
            ("This is the worst service ever", "negative"),
            ("The meeting went well today", "positive"),
            ("I'm disappointed with the results", "negative"),
            ("Everything looks good so far", "positive"),
            ("This is completely unacceptable", "negative"),
            ("Great job on the presentation", "positive"),
            ("The system is not working properly", "negative"),
            ("I'm satisfied with the outcome", "positive"),
            ("This needs immediate attention", "negative")
        ] * 5  # Repeat for more test data
        
        predictions = []
        actual_labels = []
        
        for text, true_sentiment in test_texts:
            try:
                response = requests.post(
                    f"{self.api_base_url}/ai/analyze-sentiment",
                    json={'text': text},
                    headers=self.get_headers()
                )
                
                if response.status_code == 200:
                    sentiment_result = response.json()
                    predicted_sentiment = sentiment_result.get('sentiment')
                    predictions.append(predicted_sentiment)
                    actual_labels.append(true_sentiment)
                    
            except Exception as e:
                logger.error(f"Error analyzing sentiment: {e}")
        
        if predictions and actual_labels:
            accuracy = accuracy_score(actual_labels, predictions)
            
            return {
                'model': 'sentiment-analyzer',
                'test_samples': len(predictions),
                'accuracy': accuracy,
                'passed': accuracy >= 0.80,  # 80% accuracy threshold
                'predictions': list(zip(actual_labels, predictions))
            }
        else:
            return {
                'model': 'sentiment-analyzer',
                'status': 'error',
                'error': 'No predictions generated'
            }
    
    def test_translation_quality(self) -> Dict[str, Any]:
        """Test translation service quality"""
        logger.info("Testing translation quality...")
        
        # Test translations with known correct translations
        test_translations = [
            ("Hello, how are you?", "es", "Hola, ¿cómo estás?"),
            ("Good morning", "fr", "Bonjour"),
            ("Thank you very much", "de", "Vielen Dank"),
            ("Please help me", "it", "Per favore aiutami"),
            ("See you later", "pt", "Até logo")
        ]
        
        results = []
        
        for source_text, target_lang, expected_translation in test_translations:
            try:
                response = requests.post(
                    f"{self.api_base_url}/ai/translate",
                    json={
                        'text': source_text,
                        'target_language': target_lang,
                        'source_language': 'en'
                    },
                    headers=self.get_headers()
                )
                
                if response.status_code == 200:
                    translation_result = response.json()
                    actual_translation = translation_result.get('translated_text')
                    
                    # Simple quality check (in real scenario, use BLEU score)
                    quality_score = self._calculate_translation_similarity(
                        expected_translation, actual_translation
                    )
                    
                    results.append({
                        'source': source_text,
                        'target_language': target_lang,
                        'expected': expected_translation,
                        'actual': actual_translation,
                        'quality_score': quality_score,
                        'passed': quality_score >= 0.7
                    })
                    
            except Exception as e:
                logger.error(f"Error translating text: {e}")
        
        overall_quality = np.mean([r['quality_score'] for r in results]) if results else 0
        
        return {
            'model': 'translator',
            'test_samples': len(results),
            'overall_quality': overall_quality,
            'passed': overall_quality >= 0.75,
            'individual_results': results
        }
    
    def test_model_performance_benchmarks(self) -> Dict[str, Any]:
        """Test model performance and response times"""
        logger.info("Testing model performance benchmarks...")
        
        performance_tests = [
            ('text-classification', '/ai/classify-text', {'text': 'Test email content', 'model': 'email-classifier'}),
            ('sentiment-analysis', '/ai/analyze-sentiment', {'text': 'This is a test message'}),
            ('translation', '/ai/translate', {'text': 'Hello world', 'target_language': 'es'}),
            ('text-generation', '/ai/generate-text', {'prompt': 'Write a brief summary', 'max_length': 100})
        ]
        
        results = {}
        
        for test_name, endpoint, payload in performance_tests:
            response_times = []
            success_count = 0
            
            # Run multiple requests to get average performance
            for _ in range(10):
                try:
                    start_time = time.time()
                    response = requests.post(
                        f"{self.api_base_url}{endpoint}",
                        json=payload,
                        headers=self.get_headers()
                    )
                    end_time = time.time()
                    
                    response_time = (end_time - start_time) * 1000  # Convert to milliseconds
                    response_times.append(response_time)
                    
                    if response.status_code == 200:
                        success_count += 1
                        
                except Exception as e:
                    logger.error(f"Performance test error for {test_name}: {e}")
            
            if response_times:
                avg_response_time = np.mean(response_times)
                success_rate = success_count / len(response_times)
                
                results[test_name] = {
                    'avg_response_time_ms': avg_response_time,
                    'success_rate': success_rate,
                    'passed': avg_response_time < 2000 and success_rate >= 0.95,  # 2s max, 95% success
                    'response_times': response_times
                }
        
        return results
    
    def _calculate_confusion_matrix(self, actual: List[str], predicted: List[str]) -> Dict[str, Dict[str, int]]:
        """Calculate confusion matrix for classification results"""
        labels = list(set(actual + predicted))
        matrix = {}
        
        for true_label in labels:
            matrix[true_label] = {}
            for pred_label in labels:
                count = sum(1 for a, p in zip(actual, predicted) if a == true_label and p == pred_label)
                matrix[true_label][pred_label] = count
        
        return matrix
    
    def _calculate_translation_similarity(self, expected: str, actual: str) -> float:
        """Calculate similarity between expected and actual translations"""
        # Simple word-based similarity (in production, use BLEU or similar)
        expected_words = set(expected.lower().split())
        actual_words = set(actual.lower().split())
        
        if not expected_words:
            return 0.0
        
        intersection = expected_words.intersection(actual_words)
        return len(intersection) / len(expected_words)
    
    def generate_test_report(self) -> str:
        """Generate comprehensive AI model test report"""
        report = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'test_results': self.test_results,
            'summary': {
                'total_tests': len(self.test_results),
                'passed_tests': sum(1 for result in self.test_results.values() 
                                  if result.get('passed', False)),
                'overall_accuracy': 0,
                'recommendations': []
            }
        }
        
        # Calculate overall metrics
        accuracies = []
        for test_name, result in self.test_results.items():
            if 'accuracy' in result:
                accuracies.append(result['accuracy'])
            elif 'overall_quality' in result:
                accuracies.append(result['overall_quality'])
        
        if accuracies:
            report['summary']['overall_accuracy'] = np.mean(accuracies)
        
        # Generate recommendations
        for test_name, result in self.test_results.items():
            if not result.get('passed', True):
                report['summary']['recommendations'].append(
                    f"Improve {test_name} model - current performance below threshold"
                )
        
        # Save report
        report_filename = f"ai_model_test_report_{int(time.time())}.json"
        with open(f"testing/reports/ai-models/{report_filename}", 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"AI model test report saved: {report_filename}")
        return report_filename
    
    def run_comprehensive_tests(self) -> str:
        """Run all AI model tests"""
        logger.info("Starting comprehensive AI model testing...")
        
        # Authenticate
        self.authenticate()
        
        # Run all tests
        self.test_results = {
            'data_quality': self.test_data_quality_validation(),
            'text_classification': self.test_text_classification_accuracy(),
            'sentiment_analysis': self.test_sentiment_analysis_accuracy(),
            'translation_quality': self.test_translation_quality(),
            'performance_benchmarks': self.test_model_performance_benchmarks()
        }
        
        # Generate report
        report_filename = self.generate_test_report()
        
        logger.info("AI model testing completed")
        return report_filename

if __name__ == "__main__":
    import sys
    
    api_url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000/api'
    
    test_suite = AIModelTestSuite(api_url)
    report_file = test_suite.run_comprehensive_tests()
    
    print(f"AI model tests completed. Report saved: {report_file}")