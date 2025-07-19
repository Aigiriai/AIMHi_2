#!/usr/bin/env python3
"""
Simple Frappe HRMS Demo - Port 8001
Demonstrates AIM Hi HRMS integration
"""

import http.server
import socketserver
import json
import urllib.parse as urlparse
from datetime import datetime
import sys
import os

# Add integration demo
sys.path.append('.')
from integration_demo import AIMHiHRMSDemo

class FrappeHTTPHandler(http.server.SimpleHTTPRequestHandler):
    
    def __init__(self, *args, **kwargs):
        self.demo = AIMHiHRMSDemo()
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        if self.path == '/':
            self.serve_dashboard()
        elif self.path.startswith('/job/'):
            job_id = self.path.split('/')[-1]
            self.serve_job_detail(job_id)
        elif self.path == '/ai-results':
            self.serve_ai_results()
        else:
            self.serve_dashboard()
    
    def do_POST(self):
        if self.path.startswith('/api/match/'):
            job_id = self.path.split('/')[-1]
            self.run_ai_matching(job_id)
        else:
            self.send_error(404)
    
    def serve_dashboard(self):
        html = '''
<!DOCTYPE html>
<html>
<head>
    <title>AIM Hi HRMS - Frappe Integration</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .sidebar { background: #2c3e50; min-height: 100vh; color: white; }
        .match-excellent { color: #27ae60; }
        .match-good { color: #3498db; }
        .match-fair { color: #f39c12; }
        .match-poor { color: #e74c3c; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <div class="col-md-2 sidebar p-3">
                <h5>🤖 AIM Hi HRMS</h5>
                <p><small>Frappe Integration</small></p>
                <ul class="nav flex-column">
                    <li><a href="/" class="nav-link text-light">Dashboard</a></li>
                    <li><a href="/job/JOB-001" class="nav-link text-light">Job Openings</a></li>
                    <li><a href="/ai-results" class="nav-link text-light">AI Results</a></li>
                </ul>
            </div>
            <div class="col-md-10 p-4">
                <h1>Frappe HRMS Dashboard</h1>
                <p class="lead">AIM Hi AI-Enhanced HR Management System</p>
                
                <div class="row mb-4">
                    <div class="col-md-3">
                        <div class="card bg-primary text-white">
                            <div class="card-body text-center">
                                <h3>2</h3>
                                <p>Job Openings</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-success text-white">
                            <div class="card-body text-center">
                                <h3>3</h3>
                                <p>Candidates</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-info text-white">
                            <div class="card-body text-center">
                                <h3>AI</h3>
                                <p>Matching Active</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-warning text-white">
                            <div class="card-body text-center">
                                <h3>✓</h3>
                                <p>Integration Ready</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h5>Available Job Openings</h5>
                    </div>
                    <div class="card-body">
                        <div class="list-group">
                            <a href="/job/JOB-001" class="list-group-item list-group-item-action">
                                <h6>Senior Python Developer</h6>
                                <p class="mb-1">Engineering Department • Open Position</p>
                                <small>5+ years Python, Django, REST APIs, Cloud deployment</small>
                            </a>
                            <a href="/job/JOB-002" class="list-group-item list-group-item-action">
                                <h6>Frontend Developer</h6>
                                <p class="mb-1">Engineering Department • Open Position</p>
                                <small>3+ years React, JavaScript, HTML/CSS, UI/UX</small>
                            </a>
                        </div>
                    </div>
                </div>
                
                <div class="alert alert-success mt-4">
                    <h6>🎯 Integration Status: ACTIVE</h6>
                    <p class="mb-0">AIM Hi's 5-dimensional AI matching is fully integrated with Frappe HRMS workflow.</p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
        '''
        
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode())
    
    def serve_job_detail(self, job_id):
        if job_id == 'JOB-001':
            job_title = 'Senior Python Developer'
            job_desc = '''We are seeking a Senior Python Developer to join our growing team.

Requirements:
- 5+ years of Python development experience
- Strong experience with Django web framework  
- REST API development and integration
- Database design and optimization (PostgreSQL, MySQL)
- Cloud deployment experience (AWS, Docker)
- Agile development methodologies
- Git version control
- Strong problem-solving skills'''
        else:
            job_title = 'Frontend Developer'
            job_desc = '''Looking for a skilled Frontend Developer to create amazing user experiences.

Requirements:
- 3+ years of React or Vue.js experience
- Strong HTML, CSS, JavaScript skills
- Experience with modern build tools
- Responsive design and mobile-first development
- Git version control
- Understanding of REST APIs'''
        
        html = f'''
<!DOCTYPE html>
<html>
<head>
    <title>{job_title} - Frappe HRMS</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .sidebar {{ background: #2c3e50; min-height: 100vh; color: white; }}
        .match-result {{ border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 8px; }}
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <div class="col-md-2 sidebar p-3">
                <h5>🤖 AIM Hi HRMS</h5>
                <ul class="nav flex-column">
                    <li><a href="/" class="nav-link text-light">Dashboard</a></li>
                    <li><a href="/job/JOB-001" class="nav-link text-light">Job Openings</a></li>
                    <li><a href="/ai-results" class="nav-link text-light">AI Results</a></li>
                </ul>
            </div>
            <div class="col-md-10 p-4">
                <h1>{job_title}</h1>
                <p class="lead">Engineering Department • Open Position</p>
                
                <div class="row">
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header">
                                <h5>Job Description</h5>
                            </div>
                            <div class="card-body">
                                <pre style="white-space: pre-wrap; font-family: inherit;">{job_desc}</pre>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <h5>🤖 AI Actions</h5>
                            </div>
                            <div class="card-body">
                                <button class="btn btn-primary btn-block mb-2" onclick="runAIMatching('{job_id}')">
                                    Run AI Matching
                                </button>
                                <button class="btn btn-success btn-block" onclick="window.location='/ai-results'">
                                    View Results
                                </button>
                                <div id="results" class="mt-3"></div>
                            </div>
                        </div>
                        
                        <div class="card mt-3">
                            <div class="card-header">
                                <h5>Candidates (3)</h5>
                            </div>
                            <div class="card-body">
                                <p><strong>Sarah Thompson</strong><br><small>6 years Python, Django expert</small></p>
                                <p><strong>Mike Rodriguez</strong><br><small>3 years JavaScript, some Python</small></p>
                                <p><strong>Dr. Emily Chen</strong><br><small>8 years Python, AI/ML expert</small></p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="ai-results" class="mt-4"></div>
            </div>
        </div>
    </div>
    
    <script>
    async function runAIMatching(jobId) {{
        document.getElementById('results').innerHTML = '<div class="alert alert-info">Running AI analysis...</div>';
        
        try {{
            const response = await fetch(`/api/match/${{jobId}}`, {{
                method: 'POST',
                headers: {{'Content-Type': 'application/json'}}
            }});
            
            const data = await response.json();
            
            if (data.status === 'success') {{
                let html = '<h5>AI Matching Results</h5>';
                data.matches.forEach(match => {{
                    let colorClass = match.match_percentage >= 80 ? 'success' : 
                                   match.match_percentage >= 60 ? 'primary' : 
                                   match.match_percentage >= 40 ? 'warning' : 'danger';
                    
                    html += `
                    <div class="card mb-2">
                        <div class="card-body">
                            <h6>${{match.candidate_name}} <span class="badge bg-${{colorClass}}">${{match.match_percentage.toFixed(1)}}%</span></h6>
                            <p><strong>Skills:</strong> ${{match.skills_score}}% | <strong>Experience:</strong> ${{match.experience_score}}% | <strong>Keywords:</strong> ${{match.keywords_score}}%</p>
                            <p><strong>Grade:</strong> ${{match.match_grade}}</p>
                        </div>
                    </div>`;
                }});
                
                document.getElementById('ai-results').innerHTML = html;
                document.getElementById('results').innerHTML = '<div class="alert alert-success">Analysis complete!</div>';
            }}
        }} catch (error) {{
            document.getElementById('results').innerHTML = '<div class="alert alert-danger">Error running analysis</div>';
        }}
    }}
    </script>
</body>
</html>
        '''
        
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode())
    
    def run_ai_matching(self, job_id):
        # Simulate the job and candidates data
        if job_id == 'JOB-001':
            job_data = {
                'id': job_id,
                'title': 'Senior Python Developer',
                'description': 'Python Django REST API PostgreSQL AWS Docker Git Agile development experience'
            }
        else:
            job_data = {
                'id': job_id, 
                'title': 'Frontend Developer',
                'description': 'React Vue JavaScript HTML CSS responsive design REST API Git experience'
            }
        
        candidates = [
            {'id': 'CAND-001', 'name': 'Sarah Thompson', 'resume_text': 'Senior Software Engineer 6 years Python Django REST API PostgreSQL AWS Docker Git Jenkins CI/CD React'},
            {'id': 'CAND-002', 'name': 'Mike Rodriguez', 'resume_text': 'Full-stack developer 3 years JavaScript Node.js React MongoDB Python personal projects Git AWS'},
            {'id': 'CAND-003', 'name': 'Dr. Emily Chen', 'resume_text': 'Data Scientist PhD 8 years Python Django Flask Machine Learning AI PostgreSQL Docker Kubernetes AWS Git'}
        ]
        
        results = []
        for candidate in candidates:
            result = self.demo.analyze_candidate(job_data, candidate)
            
            match_data = {
                'candidate_id': candidate['id'],
                'candidate_name': candidate['name'],
                'match_percentage': result.matchPercentage,
                'match_grade': 'Excellent' if result.matchPercentage >= 80 else 
                              'Good' if result.matchPercentage >= 60 else
                              'Fair' if result.matchPercentage >= 40 else 'Poor',
                'skills_score': result.criteriaScores.skillsMatch,
                'experience_score': result.criteriaScores.experienceLevel,
                'keywords_score': result.criteriaScores.keywordRelevance,
                'depth_score': result.criteriaScores.professionalDepth,
                'domain_score': result.criteriaScores.domainExperience
            }
            results.append(match_data)
        
        results.sort(key=lambda x: x['match_percentage'], reverse=True)
        
        response_data = {
            'status': 'success',
            'total_candidates': len(results),
            'matches': results
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode())
    
    def serve_ai_results(self):
        html = '''
<!DOCTYPE html>
<html>
<head>
    <title>AI Match Results - Frappe HRMS</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .sidebar { background: #2c3e50; min-height: 100vh; color: white; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <div class="col-md-2 sidebar p-3">
                <h5>🤖 AIM Hi HRMS</h5>
                <ul class="nav flex-column">
                    <li><a href="/" class="nav-link text-light">Dashboard</a></li>
                    <li><a href="/job/JOB-001" class="nav-link text-light">Job Openings</a></li>
                    <li><a href="/ai-results" class="nav-link text-light">AI Results</a></li>
                </ul>
            </div>
            <div class="col-md-10 p-4">
                <h1>AI Match Results</h1>
                <p class="lead">Comprehensive candidate analysis results</p>
                
                <div class="alert alert-info">
                    <h6>🎯 5-Dimensional AI Analysis</h6>
                    <p class="mb-0">Results based on Skills (25%), Keywords (25%), Domain (20%), Experience (15%), Professional Depth (15%)</p>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h5>Recent Match Results</h5>
                    </div>
                    <div class="card-body">
                        <p class="text-muted">Run AI matching on job openings to see results here.</p>
                        <p><strong>Available Actions:</strong></p>
                        <ul>
                            <li>Visit <a href="/job/JOB-001">Senior Python Developer</a> and click "Run AI Matching"</li>
                            <li>Visit <a href="/job/JOB-002">Frontend Developer</a> and click "Run AI Matching"</li>
                        </ul>
                    </div>
                </div>
                
                <div class="alert alert-success mt-4">
                    <h6>✅ Integration Validated</h6>
                    <p class="mb-0">AIM Hi's AI matching engine is successfully integrated with Frappe HRMS workflow.</p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
        '''
        
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode())

if __name__ == "__main__":
    PORT = 8001
    print(f"🚀 Starting AIM Hi HRMS Demo Server on port {PORT}")
    print(f"🌐 Access Frappe HRMS integration at: http://localhost:{PORT}")
    print("📋 Features:")
    print("  • Dashboard with job openings and candidates")
    print("  • Job detail pages with AI matching functionality")
    print("  • Real-time AI analysis with 5-dimensional scoring")
    print("  • Integration demonstration with Frappe HRMS UI")
    
    with socketserver.TCPServer(("", PORT), FrappeHTTPHandler) as httpd:
        print(f"✅ Server started successfully on port {PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")