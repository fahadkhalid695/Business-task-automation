#!/usr/bin/env python3
"""
OWASP ZAP Security Testing Suite
Automated security testing for Business Task Automation Platform
"""

import time
import json
import requests
from zapv2 import ZAPv2
import logging
from typing import Dict, List, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SecurityTestSuite:
    def __init__(self, target_url: str = 'http://localhost:3000', zap_proxy: str = 'http://localhost:8080'):
        self.target_url = target_url
        self.zap_proxy = zap_proxy
        self.zap = ZAPv2(proxies={'http': zap_proxy, 'https': zap_proxy})
        self.session_token = None
        
    def setup_authentication(self):
        """Setup authentication for authenticated scanning"""
        try:
            # Login to get session token
            login_data = {
                'email': 'security-test@example.com',
                'password': 'SecureTestPassword123!'
            }
            
            response = requests.post(
                f"{self.target_url}/api/auth/login",
                json=login_data,
                proxies={'http': self.zap_proxy, 'https': self.zap_proxy}
            )
            
            if response.status_code == 200:
                self.session_token = response.json().get('token')
                logger.info("Authentication successful")
                
                # Configure ZAP authentication
                self.zap.authentication.set_authentication_method(
                    contextid=0,
                    authmethodname='httpAuthentication',
                    authmethodconfigparams='loginUrl=' + f"{self.target_url}/api/auth/login"
                )
                
        except Exception as e:
            logger.error(f"Authentication setup failed: {e}")
    
    def passive_scan(self) -> Dict[str, Any]:
        """Perform passive security scanning"""
        logger.info("Starting passive scan...")
        
        # Spider the application
        spider_id = self.zap.spider.scan(self.target_url)
        
        # Wait for spider to complete
        while int(self.zap.spider.status(spider_id)) < 100:
            logger.info(f"Spider progress: {self.zap.spider.status(spider_id)}%")
            time.sleep(5)
        
        logger.info("Spider completed")
        
        # Get passive scan results
        alerts = self.zap.core.alerts()
        
        return {
            'scan_type': 'passive',
            'alerts_count': len(alerts),
            'alerts': alerts,
            'urls_found': len(self.zap.core.urls())
        }
    
    def active_scan(self) -> Dict[str, Any]:
        """Perform active security scanning"""
        logger.info("Starting active scan...")
        
        # Start active scan
        scan_id = self.zap.ascan.scan(self.target_url)
        
        # Wait for active scan to complete
        while int(self.zap.ascan.status(scan_id)) < 100:
            logger.info(f"Active scan progress: {self.zap.ascan.status(scan_id)}%")
            time.sleep(10)
        
        logger.info("Active scan completed")
        
        # Get active scan results
        alerts = self.zap.core.alerts()
        
        return {
            'scan_type': 'active',
            'alerts_count': len(alerts),
            'alerts': alerts,
            'scan_id': scan_id
        }
    
    def test_authentication_bypass(self) -> List[Dict[str, Any]]:
        """Test for authentication bypass vulnerabilities"""
        logger.info("Testing authentication bypass...")
        
        test_results = []
        protected_endpoints = [
            '/api/admin/users',
            '/api/workflows',
            '/api/tasks',
            '/api/analytics/reports',
            '/api/integrations'
        ]
        
        for endpoint in protected_endpoints:
            try:
                # Test without authentication
                response = requests.get(
                    f"{self.target_url}{endpoint}",
                    proxies={'http': self.zap_proxy, 'https': self.zap_proxy}
                )
                
                test_results.append({
                    'endpoint': endpoint,
                    'status_code': response.status_code,
                    'vulnerable': response.status_code == 200,
                    'test': 'authentication_bypass'
                })
                
            except Exception as e:
                logger.error(f"Error testing {endpoint}: {e}")
        
        return test_results
    
    def test_sql_injection(self) -> List[Dict[str, Any]]:
        """Test for SQL injection vulnerabilities"""
        logger.info("Testing SQL injection...")
        
        test_results = []
        sql_payloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "1' AND 1=1 --",
            "1' AND 1=2 --"
        ]
        
        test_endpoints = [
            '/api/users/search?q=',
            '/api/tasks/filter?status=',
            '/api/workflows/search?name='
        ]
        
        headers = {'Authorization': f'Bearer {self.session_token}'} if self.session_token else {}
        
        for endpoint in test_endpoints:
            for payload in sql_payloads:
                try:
                    response = requests.get(
                        f"{self.target_url}{endpoint}{payload}",
                        headers=headers,
                        proxies={'http': self.zap_proxy, 'https': self.zap_proxy}
                    )
                    
                    # Check for SQL error messages
                    sql_errors = [
                        'sql syntax',
                        'mysql_fetch',
                        'ora-',
                        'postgresql',
                        'sqlite_',
                        'mongodb'
                    ]
                    
                    response_text = response.text.lower()
                    vulnerable = any(error in response_text for error in sql_errors)
                    
                    test_results.append({
                        'endpoint': endpoint,
                        'payload': payload,
                        'status_code': response.status_code,
                        'vulnerable': vulnerable,
                        'test': 'sql_injection'
                    })
                    
                except Exception as e:
                    logger.error(f"Error testing SQL injection on {endpoint}: {e}")
        
        return test_results
    
    def test_xss_vulnerabilities(self) -> List[Dict[str, Any]]:
        """Test for Cross-Site Scripting vulnerabilities"""
        logger.info("Testing XSS vulnerabilities...")
        
        test_results = []
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "';alert('XSS');//",
            "<svg onload=alert('XSS')>"
        ]
        
        test_endpoints = [
            '/api/workflows',
            '/api/tasks',
            '/api/users/profile'
        ]
        
        headers = {
            'Authorization': f'Bearer {self.session_token}',
            'Content-Type': 'application/json'
        } if self.session_token else {'Content-Type': 'application/json'}
        
        for endpoint in test_endpoints:
            for payload in xss_payloads:
                try:
                    test_data = {
                        'name': payload,
                        'description': payload,
                        'content': payload
                    }
                    
                    response = requests.post(
                        f"{self.target_url}{endpoint}",
                        json=test_data,
                        headers=headers,
                        proxies={'http': self.zap_proxy, 'https': self.zap_proxy}
                    )
                    
                    # Check if payload is reflected without encoding
                    vulnerable = payload in response.text and '<script>' in response.text
                    
                    test_results.append({
                        'endpoint': endpoint,
                        'payload': payload,
                        'status_code': response.status_code,
                        'vulnerable': vulnerable,
                        'test': 'xss'
                    })
                    
                except Exception as e:
                    logger.error(f"Error testing XSS on {endpoint}: {e}")
        
        return test_results
    
    def test_csrf_protection(self) -> List[Dict[str, Any]]:
        """Test for CSRF protection"""
        logger.info("Testing CSRF protection...")
        
        test_results = []
        state_changing_endpoints = [
            ('/api/users', 'POST'),
            ('/api/workflows', 'POST'),
            ('/api/tasks', 'POST'),
            ('/api/users/1', 'DELETE'),
            ('/api/workflows/1', 'DELETE')
        ]
        
        for endpoint, method in state_changing_endpoints:
            try:
                # Test without CSRF token
                if method == 'POST':
                    response = requests.post(
                        f"{self.target_url}{endpoint}",
                        json={'test': 'csrf'},
                        proxies={'http': self.zap_proxy, 'https': self.zap_proxy}
                    )
                elif method == 'DELETE':
                    response = requests.delete(
                        f"{self.target_url}{endpoint}",
                        proxies={'http': self.zap_proxy, 'https': self.zap_proxy}
                    )
                
                # If request succeeds without CSRF token, it's vulnerable
                vulnerable = response.status_code in [200, 201, 204]
                
                test_results.append({
                    'endpoint': endpoint,
                    'method': method,
                    'status_code': response.status_code,
                    'vulnerable': vulnerable,
                    'test': 'csrf'
                })
                
            except Exception as e:
                logger.error(f"Error testing CSRF on {endpoint}: {e}")
        
        return test_results
    
    def generate_report(self, results: Dict[str, Any]) -> str:
        """Generate security test report"""
        report = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'target_url': self.target_url,
            'summary': {
                'total_vulnerabilities': 0,
                'high_risk': 0,
                'medium_risk': 0,
                'low_risk': 0
            },
            'test_results': results
        }
        
        # Count vulnerabilities by risk level
        for test_type, test_results in results.items():
            if isinstance(test_results, list):
                for result in test_results:
                    if result.get('vulnerable', False):
                        report['summary']['total_vulnerabilities'] += 1
                        # Classify risk level based on test type
                        if test_type in ['sql_injection', 'authentication_bypass']:
                            report['summary']['high_risk'] += 1
                        elif test_type in ['xss', 'csrf']:
                            report['summary']['medium_risk'] += 1
                        else:
                            report['summary']['low_risk'] += 1
        
        # Save report
        report_filename = f"security_report_{int(time.time())}.json"
        with open(f"testing/reports/security/{report_filename}", 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Security report saved: {report_filename}")
        return report_filename
    
    def run_comprehensive_scan(self) -> str:
        """Run comprehensive security testing suite"""
        logger.info("Starting comprehensive security scan...")
        
        # Setup
        self.setup_authentication()
        
        # Run all tests
        results = {
            'passive_scan': self.passive_scan(),
            'active_scan': self.active_scan(),
            'authentication_bypass': self.test_authentication_bypass(),
            'sql_injection': self.test_sql_injection(),
            'xss': self.test_xss_vulnerabilities(),
            'csrf': self.test_csrf_protection()
        }
        
        # Generate report
        report_filename = self.generate_report(results)
        
        logger.info("Comprehensive security scan completed")
        return report_filename

if __name__ == "__main__":
    import sys
    
    target_url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
    
    security_suite = SecurityTestSuite(target_url)
    report_file = security_suite.run_comprehensive_scan()
    
    print(f"Security scan completed. Report saved: {report_file}")