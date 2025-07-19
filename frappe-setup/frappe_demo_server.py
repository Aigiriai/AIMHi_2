#!/usr/bin/env python3
"""
Frappe HRMS Demo Server - Port 8001
Demonstrates the complete AIM Hi HRMS integration with web interface
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import json
import os
from datetime import datetime
import sys

# Add our integration demo to path
sys.path.append('.')
from integration_demo import AIMHiHRMSDemo

app = Flask(__name__)
app.secret_key = 'frappe_demo_secret_key_2025'

# Global demo instance
demo = AIMHiHRMSDemo()

# Sample data
sample_jobs = [
    {
        'id': 'JOB-001',
        'title': 'Senior Python Developer', 
        'status': 'Open',
        'department': 'Engineering',
        'created_on': '2025-07-19',
        'description': '''We are seeking a Senior Python Developer to join our growing team. 

Requirements:
- 5+ years of Python development experience
- Strong experience with Django web framework
- REST API development and integration
- Database design and optimization (PostgreSQL, MySQL)
- Cloud deployment experience (AWS, Docker)
- Agile development methodologies
- Git version control
- Strong problem-solving skills

Preferred:
- React or Vue.js frontend experience
- CI/CD pipeline setup
- Microservices architecture
- Redis caching
- Machine learning or AI experience'''
    },
    {
        'id': 'JOB-002',
        'title': 'Frontend Developer',
        'status': 'Open', 
        'department': 'Engineering',
        'created_on': '2025-07-19',
        'description': '''Looking for a skilled Frontend Developer to create amazing user experiences.

Requirements:
- 3+ years of React or Vue.js experience
- Strong HTML, CSS, JavaScript skills
- Experience with modern build tools (Webpack, Vite)
- Responsive design and mobile-first development
- Git version control
- Understanding of REST APIs

Preferred:
- TypeScript experience
- UI/UX design skills
- Testing frameworks (Jest, Cypress)
- Some backend knowledge'''
    }
]

sample_candidates = [
    {
        'id': 'CAND-001',
        'name': 'Sarah Thompson',
        'email': 'sarah.thompson@email.com',
        'status': 'Open',
        'applied_on': '2025-07-19',
        'resume_text': '''Senior Software Engineer with 6 years of Python development experience. 
Expertise in Django web framework, building scalable REST APIs, and database optimization. 
Proficient in PostgreSQL, MySQL, and Redis caching solutions.

Technical Skills:
- Python, Django, Flask, FastAPI
- PostgreSQL, MySQL, Redis
- AWS cloud deployment, Docker containerization
- Git, Jenkins, CI/CD pipelines
- React frontend development
- Agile/Scrum methodologies

Project Experience:
- Led development of microservices architecture handling 100K+ daily users
- Built and deployed 15+ REST APIs with comprehensive testing
- Managed database migrations and optimization reducing query time by 40%
- Implemented CI/CD pipelines reducing deployment time from hours to minutes'''
    },
    {
        'id': 'CAND-002',
        'name': 'Mike Rodriguez', 
        'email': 'mike.rodriguez@email.com',
        'status': 'Open',
        'applied_on': '2025-07-19',
        'resume_text': '''Full-stack developer with 3 years of experience primarily in JavaScript and Node.js.
Some Python knowledge through personal projects and bootcamp training.
Experience with React, MongoDB, and basic cloud deployment.

Technical Skills:
- JavaScript, Node.js, Express
- React, HTML, CSS
- MongoDB, basic SQL
- Some Python (personal projects)
- Git version control
- Basic AWS deployment

Experience:
- Built 5 web applications using MERN stack
- Worked on small team using agile methodology
- Deployed applications to cloud platforms
- Strong frontend development skills'''
    },
    {
        'id': 'CAND-003',
        'name': 'Dr. Emily Chen',
        'email': 'emily.chen@email.com', 
        'status': 'Open',
        'applied_on': '2025-07-19',
        'resume_text': '''Data Scientist and Software Engineer with 8 years of Python experience.
PhD in Computer Science with specialization in Machine Learning and AI.
Extensive experience in Python, data analysis, and building production ML systems.

Technical Skills:
- Python (expert level), Django, Flask
- Machine Learning, AI, Deep Learning
- PostgreSQL, MongoDB, Redis
- Docker, Kubernetes, AWS, GCP
- Git, CI/CD, MLOps pipelines
- REST API development
- Agile methodologies

Experience:
- Built and deployed 20+ machine learning models in production
- Led team of 8 engineers developing AI-powered solutions
- Designed microservices architecture for ML inference
- Implemented real-time data processing pipelines handling TB of data
- Published 15 research papers in AI conferences'''
    }
]

# Store match results
match_results = {}

@app.route('/')
def dashboard():
    """Frappe HRMS Dashboard"""
    return render_template('dashboard.html', 
                         jobs=sample_jobs,
                         candidates=sample_candidates,
                         total_jobs=len(sample_jobs),
                         total_candidates=len(sample_candidates))

@app.route('/job-opening')
def job_opening_list():
    """Job Opening List"""
    return render_template('job_opening_list.html', jobs=sample_jobs)

@app.route('/job-opening/<job_id>')
def job_opening_detail(job_id):
    """Job Opening Detail with AI Matching"""
    job = next((j for j in sample_jobs if j['id'] == job_id), None)
    if not job:
        return "Job not found", 404
    
    # Get match results for this job
    job_matches = match_results.get(job_id, [])
    
    return render_template('job_opening_detail.html', 
                         job=job,
                         candidates=sample_candidates,
                         matches=job_matches)

@app.route('/api/run-ai-matching/<job_id>', methods=['POST'])
def run_ai_matching(job_id):
    """Run AI Matching for a job"""
    job = next((j for j in sample_jobs if j['id'] == job_id), None)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    # Run AI matching for all candidates
    results = []
    for candidate in sample_candidates:
        result = demo.analyze_candidate(job, candidate)
        
        # Convert to dict for JSON serialization
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
            'domain_score': result.criteriaScores.domainExperience,
            'reasoning': result.reasoning,
            'processed_on': datetime.now().isoformat()
        }
        results.append(match_data)
    
    # Store results
    match_results[job_id] = results
    
    # Sort by match percentage
    results.sort(key=lambda x: x['match_percentage'], reverse=True)
    
    return jsonify({
        'status': 'success',
        'total_candidates': len(results),
        'matches': results
    })

@app.route('/ai-match-results')
def ai_match_results():
    """AI Match Results List"""
    all_matches = []
    for job_id, matches in match_results.items():
        job = next((j for j in sample_jobs if j['id'] == job_id), None)
        for match in matches:
            match['job_title'] = job['title'] if job else 'Unknown Job'
            all_matches.append(match)
    
    # Sort by match percentage
    all_matches.sort(key=lambda x: x['match_percentage'], reverse=True)
    
    return render_template('ai_match_results.html', matches=all_matches)

@app.route('/ai-configuration')
def ai_configuration():
    """AI Matching Configuration"""
    return render_template('ai_configuration.html', config=demo.config)

@app.route('/api/update-ai-config', methods=['POST'])
def update_ai_config():
    """Update AI configuration"""
    data = request.get_json()
    
    # Validate weights sum to 100
    total = (data.get('skills_weight', 0) + 
             data.get('experience_weight', 0) + 
             data.get('keywords_weight', 0) + 
             data.get('professional_depth_weight', 0) + 
             data.get('domain_experience_weight', 0))
    
    if total != 100:
        return jsonify({'error': f'Weights must sum to 100%. Current total: {total}%'}), 400
    
    # Update configuration
    demo.config.update(data)
    
    return jsonify({'status': 'success', 'message': 'Configuration updated successfully'})

if __name__ == '__main__':
    # Create templates directory and files
    os.makedirs('templates', exist_ok=True)
    
    # Create base template
    base_template = '''
<!DOCTYPE html>
<html>
<head>
    <title>{% block title %}Frappe HRMS with AIM Hi AI{% endblock %}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .sidebar { background: #2c3e50; min-height: 100vh; }
        .sidebar .nav-link { color: #ecf0f1; }
        .sidebar .nav-link:hover { color: #3498db; }
        .match-excellent { color: #27ae60; }
        .match-good { color: #3498db; }
        .match-fair { color: #f39c12; }
        .match-poor { color: #e74c3c; }
        .navbar-brand { font-weight: bold; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <div class="col-md-2 sidebar p-3">
                <h5 class="text-light mb-4"><i class="fas fa-magic"></i> AIM Hi HRMS</h5>
                <nav class="nav flex-column">
                    <a class="nav-link" href="/"><i class="fas fa-tachometer-alt"></i> Dashboard</a>
                    <a class="nav-link" href="/job-opening"><i class="fas fa-briefcase"></i> Job Openings</a>
                    <a class="nav-link" href="/ai-match-results"><i class="fas fa-robot"></i> AI Match Results</a>
                    <a class="nav-link" href="/ai-configuration"><i class="fas fa-cog"></i> AI Configuration</a>
                </nav>
            </div>
            <div class="col-md-10">
                <nav class="navbar navbar-light bg-light mb-4">
                    <span class="navbar-brand">{% block page_title %}Frappe HRMS{% endblock %}</span>
                    <span class="badge bg-success">AI-Enhanced</span>
                </nav>
                {% block content %}{% endblock %}
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    {% block scripts %}{% endblock %}
</body>
</html>
    '''
    
    dashboard_template = '''
{% extends "base.html" %}
{% block title %}Dashboard - Frappe HRMS{% endblock %}
{% block page_title %}Dashboard{% endblock %}
{% block content %}
<div class="row mb-4">
    <div class="col-md-3">
        <div class="card bg-primary text-white">
            <div class="card-body">
                <h5>Total Jobs</h5>
                <h2>{{ total_jobs }}</h2>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card bg-success text-white">
            <div class="card-body">
                <h5>Total Candidates</h5>
                <h2>{{ total_candidates }}</h2>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card bg-info text-white">
            <div class="card-body">
                <h5>AI Matches</h5>
                <h2>0</h2>
                <small>Run AI matching on jobs</small>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card bg-warning text-white">
            <div class="card-body">
                <h5>Integration</h5>
                <h2><i class="fas fa-check-circle"></i></h2>
                <small>AIM Hi AI Active</small>
            </div>
        </div>
    </div>
</div>

<div class="row">
    <div class="col-md-6">
        <div class="card">
            <div class="card-header">
                <h5>Recent Job Openings</h5>
            </div>
            <div class="card-body">
                {% for job in jobs %}
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <strong>{{ job.title }}</strong><br>
                        <small class="text-muted">{{ job.department }} • {{ job.created_on }}</small>
                    </div>
                    <span class="badge bg-success">{{ job.status }}</span>
                </div>
                {% endfor %}
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card">
            <div class="card-header">
                <h5>Recent Candidates</h5>
            </div>
            <div class="card-body">
                {% for candidate in candidates %}
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <strong>{{ candidate.name }}</strong><br>
                        <small class="text-muted">{{ candidate.email }} • {{ candidate.applied_on }}</small>
                    </div>
                    <span class="badge bg-primary">{{ candidate.status }}</span>
                </div>
                {% endfor %}
            </div>
        </div>
    </div>
</div>
{% endblock %}
    '''
    
    job_detail_template = '''
{% extends "base.html" %}
{% block title %}{{ job.title }} - Job Opening{% endblock %}
{% block page_title %}Job Opening: {{ job.title }}{% endblock %}
{% block content %}
<div class="row">
    <div class="col-md-8">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5>Job Details</h5>
                <span class="badge bg-success">{{ job.status }}</span>
            </div>
            <div class="card-body">
                <h6><strong>Department:</strong> {{ job.department }}</h6>
                <h6><strong>Created:</strong> {{ job.created_on }}</h6>
                <hr>
                <h6>Description:</h6>
                <pre style="white-space: pre-wrap;">{{ job.description }}</pre>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header">
                <h5><i class="fas fa-robot"></i> AI Matching Results</h5>
            </div>
            <div class="card-body">
                {% if matches %}
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Candidate</th>
                                <th>Match %</th>
                                <th>Grade</th>
                                <th>Skills</th>
                                <th>Experience</th>
                                <th>Keywords</th>
                            </tr>
                        </thead>
                        <tbody>
                            {% for match in matches %}
                            <tr>
                                <td>{{ match.candidate_name }}</td>
                                <td><strong>{{ "%.1f"|format(match.match_percentage) }}%</strong></td>
                                <td><span class="badge bg-{% if match.match_grade == 'Excellent' %}success{% elif match.match_grade == 'Good' %}primary{% elif match.match_grade == 'Fair' %}warning{% else %}danger{% endif %}">{{ match.match_grade }}</span></td>
                                <td>{{ match.skills_score }}%</td>
                                <td>{{ match.experience_score }}%</td>
                                <td>{{ match.keywords_score }}%</td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>
                {% else %}
                <p class="text-muted">No AI matching results yet. Click "Run AI Matching" to analyze candidates.</p>
                {% endif %}
            </div>
        </div>
    </div>
    
    <div class="col-md-4">
        <div class="card">
            <div class="card-header">
                <h5><i class="fas fa-magic"></i> AI Actions</h5>
            </div>
            <div class="card-body">
                <button class="btn btn-primary btn-block mb-3" onclick="runAIMatching()">
                    <i class="fas fa-robot"></i> Run AI Matching
                </button>
                <button class="btn btn-success btn-block" onclick="window.location.href='/ai-match-results'">
                    <i class="fas fa-chart-bar"></i> View All Results
                </button>
                
                <div id="matching-progress" class="mt-3" style="display: none;">
                    <div class="progress">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
                    </div>
                    <small class="text-muted">Running AI analysis...</small>
                </div>
            </div>
        </div>
        
        <div class="card mt-3">
            <div class="card-header">
                <h5>Candidates ({{ candidates|length }})</h5>
            </div>
            <div class="card-body">
                {% for candidate in candidates %}
                <div class="mb-2">
                    <strong>{{ candidate.name }}</strong><br>
                    <small class="text-muted">{{ candidate.email }}</small>
                </div>
                {% endfor %}
            </div>
        </div>
    </div>
</div>

<script>
function runAIMatching() {
    $('#matching-progress').show();
    
    fetch('/api/run-ai-matching/{{ job.id }}', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    })
    .then(response => response.json())
    .then(data => {
        $('#matching-progress').hide();
        if (data.status === 'success') {
            alert(`AI matching completed! Analyzed ${data.total_candidates} candidates.`);
            location.reload();
        } else {
            alert('Error running AI matching: ' + data.error);
        }
    })
    .catch(error => {
        $('#matching-progress').hide();
        alert('Error: ' + error);
    });
}
</script>
{% endblock %}
    '''
    
    # Write template files
    with open('templates/base.html', 'w') as f:
        f.write(base_template)
    
    with open('templates/dashboard.html', 'w') as f:
        f.write(dashboard_template)
    
    with open('templates/job_opening_detail.html', 'w') as f:
        f.write(job_detail_template)
    
    print("🚀 Starting Frappe HRMS Demo Server on port 8001...")
    print("🌐 Access at: http://localhost:8001")
    print("📋 Features: Job Openings, AI Matching, Results Dashboard")
    
    app.run(host='0.0.0.0', port=8001, debug=True)