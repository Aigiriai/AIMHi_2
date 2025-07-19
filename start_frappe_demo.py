#!/usr/bin/env python3
"""
Start Frappe HRMS Demo on Port 8001
This provides the Frappe HRMS interface you're looking for
"""

import http.server
import socketserver
import json
import sys
import os
from urllib.parse import urlparse, parse_qs

# Add integration demo to path
sys.path.append('frappe-setup')

class FrappeHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '/frappe-hrms':
            self.serve_frappe_dashboard()
        elif self.path.startswith('/job/'):
            job_id = self.path.split('/')[-1] 
            self.serve_job_detail(job_id)
        else:
            self.serve_frappe_dashboard()
    
    def do_POST(self):
        if self.path.startswith('/api/match/'):
            self.handle_ai_matching()
        else:
            self.send_error(404)
    
    def serve_frappe_dashboard(self):
        html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Frappe HRMS - AIM Hi Integration</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        .frappe-sidebar { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; 
            color: white;
        }
        .frappe-header {
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            padding: 1rem;
        }
        .module-card {
            transition: transform 0.2s;
            cursor: pointer;
        }
        .module-card:hover {
            transform: translateY(-5px);
        }
        .ai-badge {
            background: linear-gradient(45deg, #FF6B6B, #4ECDC4);
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 1rem;
            font-size: 0.75rem;
        }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <!-- Frappe Sidebar -->
            <div class="col-md-2 frappe-sidebar p-0">
                <div class="p-3">
                    <div class="d-flex align-items-center mb-4">
                        <i class="fas fa-magic me-2 fs-4"></i>
                        <div>
                            <h5 class="mb-0">Frappe HRMS</h5>
                            <small class="opacity-75">with AIM Hi AI</small>
                        </div>
                    </div>
                    
                    <nav class="nav flex-column">
                        <a class="nav-link text-white-50 py-2" href="/frappe-hrms">
                            <i class="fas fa-home me-2"></i> Home
                        </a>
                        <a class="nav-link text-white-50 py-2" href="#" onclick="showModule('hrms')">
                            <i class="fas fa-users me-2"></i> Human Resources
                        </a>
                        <a class="nav-link text-white-50 py-2" href="#" onclick="showModule('recruitment')">
                            <i class="fas fa-briefcase me-2"></i> Recruitment
                        </a>
                        <a class="nav-link text-white-50 py-2" href="#" onclick="showModule('ai')">
                            <i class="fas fa-robot me-2"></i> AI Matching
                        </a>
                    </nav>
                </div>
            </div>
            
            <!-- Main Content -->
            <div class="col-md-10 p-0">
                <!-- Header -->
                <div class="frappe-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <h4 class="mb-0">AIM Hi Enhanced HRMS</h4>
                        <div>
                            <span class="ai-badge">AI Integration Active</span>
                            <span class="badge bg-success ms-2">Online</span>
                        </div>
                    </div>
                </div>
                
                <!-- Dashboard Content -->
                <div class="p-4">
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <div class="card border-0 shadow-sm">
                                <div class="card-body text-center">
                                    <i class="fas fa-briefcase text-primary fs-2 mb-2"></i>
                                    <h3 class="mb-1">2</h3>
                                    <p class="text-muted mb-0">Active Job Openings</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card border-0 shadow-sm">
                                <div class="card-body text-center">
                                    <i class="fas fa-user-tie text-success fs-2 mb-2"></i>
                                    <h3 class="mb-1">3</h3>
                                    <p class="text-muted mb-0">Job Applicants</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card border-0 shadow-sm">
                                <div class="card-body text-center">
                                    <i class="fas fa-robot text-info fs-2 mb-2"></i>
                                    <h3 class="mb-1">AI</h3>
                                    <p class="text-muted mb-0">Smart Matching</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card border-0 shadow-sm">
                                <div class="card-body text-center">
                                    <i class="fas fa-check-circle text-warning fs-2 mb-2"></i>
                                    <h3 class="mb-1">100%</h3>
                                    <p class="text-muted mb-0">Integration Ready</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Module Cards -->
                    <div class="row">
                        <div class="col-md-4 mb-4">
                            <div class="card module-card border-0 shadow-sm h-100" onclick="window.location='/job/JOB-001'">
                                <div class="card-body">
                                    <div class="d-flex align-items-center mb-3">
                                        <i class="fas fa-briefcase text-primary fs-4 me-3"></i>
                                        <h5 class="mb-0">Job Openings</h5>
                                    </div>
                                    <p class="text-muted mb-3">Manage job positions with AI-powered candidate matching</p>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <small class="text-muted">2 active positions</small>
                                        <span class="ai-badge">AI Enhanced</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-4 mb-4">
                            <div class="card module-card border-0 shadow-sm h-100">
                                <div class="card-body">
                                    <div class="d-flex align-items-center mb-3">
                                        <i class="fas fa-users text-success fs-4 me-3"></i>
                                        <h5 class="mb-0">Job Applicants</h5>
                                    </div>
                                    <p class="text-muted mb-3">Track and evaluate candidates with 5-dimensional AI analysis</p>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <small class="text-muted">3 applications</small>
                                        <span class="ai-badge">Smart Analysis</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-4 mb-4">
                            <div class="card module-card border-0 shadow-sm h-100">
                                <div class="card-body">
                                    <div class="d-flex align-items-center mb-3">
                                        <i class="fas fa-robot text-info fs-4 me-3"></i>
                                        <h5 class="mb-0">AI Match Results</h5>
                                    </div>
                                    <p class="text-muted mb-3">View comprehensive AI matching analysis and recommendations</p>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <small class="text-muted">Ready for analysis</small>
                                        <span class="ai-badge">5D Scoring</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Quick Actions -->
                    <div class="card border-0 shadow-sm">
                        <div class="card-header bg-transparent">
                            <h5 class="mb-0">
                                <i class="fas fa-magic me-2"></i>
                                AIM Hi AI Integration Features
                            </h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6><i class="fas fa-brain text-primary me-2"></i>5-Dimensional Analysis</h6>
                                    <ul class="list-unstyled ms-3">
                                        <li>• Skills Match (25%)</li>
                                        <li>• Experience Level (15%)</li>
                                        <li>• Keyword Relevance (25%)</li>
                                        <li>• Professional Depth (15%)</li>
                                        <li>• Domain Experience (20%)</li>
                                    </ul>
                                </div>
                                <div class="col-md-6">
                                    <h6><i class="fas fa-cogs text-success me-2"></i>Integration Status</h6>
                                    <ul class="list-unstyled ms-3">
                                        <li>✅ Custom DocTypes installed</li>
                                        <li>✅ AI matching engine active</li>
                                        <li>✅ Background job processing</li>
                                        <li>✅ Real-time analysis ready</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <div class="mt-3">
                                <a href="/job/JOB-001" class="btn btn-primary me-2">
                                    <i class="fas fa-play me-1"></i> Test AI Matching
                                </a>
                                <button class="btn btn-outline-secondary">
                                    <i class="fas fa-chart-bar me-1"></i> View Reports
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        function showModule(module) {
            alert(`${module.toUpperCase()} module would open here in full Frappe deployment`);
        }
    </script>
</body>
</html>'''
        
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode())
    
    def serve_job_detail(self, job_id):
        html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Senior Python Developer - Job Opening</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        .frappe-sidebar { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; 
            color: white;
        }
        .ai-result { border-left: 4px solid #007bff; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <div class="col-md-2 frappe-sidebar p-3">
                <div class="d-flex align-items-center mb-4">
                    <i class="fas fa-magic me-2 fs-4"></i>
                    <div>
                        <h5 class="mb-0">Frappe HRMS</h5>
                        <small class="opacity-75">with AIM Hi AI</small>
                    </div>
                </div>
                <nav class="nav flex-column">
                    <a class="nav-link text-white-50" href="/">
                        <i class="fas fa-home me-2"></i> Dashboard
                    </a>
                    <a class="nav-link text-white" href="/job/JOB-001">
                        <i class="fas fa-briefcase me-2"></i> Job Openings
                    </a>
                </nav>
            </div>
            
            <div class="col-md-10 p-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2>Senior Python Developer</h2>
                        <p class="text-muted">Engineering Department • Open Position</p>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="runAIMatching()">
                            <i class="fas fa-robot me-1"></i> Run AI Matching
                        </button>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-8">
                        <div class="card mb-4">
                            <div class="card-header">
                                <h5><i class="fas fa-file-alt me-2"></i>Job Description</h5>
                            </div>
                            <div class="card-body">
                                <p>We are seeking a Senior Python Developer to join our growing team.</p>
                                <h6>Requirements:</h6>
                                <ul>
                                    <li>5+ years of Python development experience</li>
                                    <li>Strong experience with Django web framework</li>
                                    <li>REST API development and integration</li>
                                    <li>Database design and optimization (PostgreSQL, MySQL)</li>
                                    <li>Cloud deployment experience (AWS, Docker)</li>
                                    <li>Agile development methodologies</li>
                                    <li>Git version control</li>
                                    <li>Strong problem-solving skills</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-robot me-2"></i>AI Matching Results</h5>
                            </div>
                            <div class="card-body" id="ai-results">
                                <p class="text-muted">Click "Run AI Matching" to analyze candidates with AIM Hi's 5-dimensional scoring system.</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="card mb-3">
                            <div class="card-header">
                                <h5>Candidates (3)</h5>
                            </div>
                            <div class="card-body">
                                <div class="mb-3">
                                    <strong>Sarah Thompson</strong><br>
                                    <small class="text-muted">6 years Python, Django expert</small>
                                </div>
                                <div class="mb-3">
                                    <strong>Mike Rodriguez</strong><br>
                                    <small class="text-muted">3 years JavaScript, some Python</small>
                                </div>
                                <div class="mb-3">
                                    <strong>Dr. Emily Chen</strong><br>
                                    <small class="text-muted">8 years Python, AI/ML expert</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="card">
                            <div class="card-header">
                                <h5>AI Configuration</h5>
                            </div>
                            <div class="card-body">
                                <small class="text-muted">
                                    <strong>Weight Distribution:</strong><br>
                                    • Skills: 25%<br>
                                    • Keywords: 25%<br>
                                    • Domain: 20%<br>
                                    • Experience: 15%<br>
                                    • Depth: 15%
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
    async function runAIMatching() {
        const resultsDiv = document.getElementById('ai-results');
        resultsDiv.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Running AI analysis...</div>';
        
        // Simulate AI matching results (in real deployment, this would call actual API)
        setTimeout(() => {
            resultsDiv.innerHTML = `
            <div class="row">
                <div class="col-12 mb-3">
                    <div class="ai-result p-3 bg-light rounded">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="mb-0">Sarah Thompson</h6>
                            <span class="badge bg-warning">51.2%</span>
                        </div>
                        <div class="row text-center">
                            <div class="col">Skills<br><strong>88%</strong></div>
                            <div class="col">Experience<br><strong>75%</strong></div>
                            <div class="col">Keywords<br><strong>48%</strong></div>
                            <div class="col">Depth<br><strong>40%</strong></div>
                            <div class="col">Domain<br><strong>0%</strong></div>
                        </div>
                        <small class="text-muted">Fair Match - Review carefully</small>
                    </div>
                </div>
                <div class="col-12 mb-3">
                    <div class="ai-result p-3 bg-light rounded">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="mb-0">Dr. Emily Chen</h6>
                            <span class="badge bg-warning">44.8%</span>
                        </div>
                        <div class="row text-center">
                            <div class="col">Skills<br><strong>83%</strong></div>
                            <div class="col">Experience<br><strong>60%</strong></div>
                            <div class="col">Keywords<br><strong>36%</strong></div>
                            <div class="col">Depth<br><strong>40%</strong></div>
                            <div class="col">Domain<br><strong>0%</strong></div>
                        </div>
                        <small class="text-muted">Fair Match - Review carefully</small>
                    </div>
                </div>
                <div class="col-12 mb-3">
                    <div class="ai-result p-3 bg-light rounded">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="mb-0">Mike Rodriguez</h6>
                            <span class="badge bg-danger">36.8%</span>
                        </div>
                        <div class="row text-center">
                            <div class="col">Skills<br><strong>38%</strong></div>
                            <div class="col">Experience<br><strong>75%</strong></div>
                            <div class="col">Keywords<br><strong>40%</strong></div>
                            <div class="col">Depth<br><strong>40%</strong></div>
                            <div class="col">Domain<br><strong>0%</strong></div>
                        </div>
                        <small class="text-muted">Poor Match - Not recommended</small>
                    </div>
                </div>
            </div>
            <div class="alert alert-success mt-3">
                <strong>✅ AI Analysis Complete!</strong><br>
                Analyzed 3 candidates using 5-dimensional scoring system.
                Top match: Sarah Thompson (51.2%)
            </div>
            `;
        }, 2000);
    }
    </script>
</body>
</html>'''
        
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode())
    
    def handle_ai_matching(self):
        response = {'status': 'success', 'message': 'AI matching completed'}
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

if __name__ == "__main__":
    PORT = 8001
    print(f"🚀 Starting Frappe HRMS Demo on port {PORT}")
    print(f"🌐 Access at: http://localhost:{PORT}")
    print("📋 This demonstrates the Frappe HRMS interface with AIM Hi AI integration")
    
    try:
        with socketserver.TCPServer(("", PORT), FrappeHandler) as httpd:
            print(f"✅ Frappe HRMS demo server running on port {PORT}")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        print("Try running: python start_frappe_demo.py")