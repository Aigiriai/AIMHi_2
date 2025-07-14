// Test script to verify AI matching consistency for identical resumes
import fetch from 'node-fetch';

async function testMatchingConsistency() {
  const baseUrl = 'http://localhost:5000';
  
  // Login as super admin
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@aimhi.app',
      password: 'SuperAdmin123!@#'
    })
  });
  
  const loginData = await loginResponse.json();
  const token = loginData.token;
  
  console.log('🔐 Authenticated successfully');
  
  // Get jobs and candidates
  const jobsResponse = await fetch(`${baseUrl}/api/jobs`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const jobs = await jobsResponse.json();
  
  const candidatesResponse = await fetch(`${baseUrl}/api/candidates`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const candidates = await candidatesResponse.json();
  
  console.log(`📊 Found ${jobs.length} jobs and ${candidates.length} candidates`);
  
  if (jobs.length === 0 || candidates.length === 0) {
    console.log('❌ No jobs or candidates found for testing');
    return;
  }
  
  // Test matching consistency with identical resume content
  const targetJob = jobs.find(job => job.title.toLowerCase().includes('c programming')) || jobs[0];
  console.log(`🎯 Testing with job: ${targetJob.title}`);
  
  // Find candidates with identical content (same resume, different names)
  const identicalCandidates = candidates.filter(candidate => 
    candidate.resumeContent && candidate.resumeContent.includes('AUTOMATION TEST ENGINEER')
  );
  
  console.log(`👥 Found ${identicalCandidates.length} candidates with similar resume content`);
  
  if (identicalCandidates.length < 2) {
    console.log('❌ Need at least 2 identical candidates for consistency testing');
    return;
  }
  
  // Run multiple matches for each candidate to test consistency
  console.log('\n🔄 Testing matching consistency...');
  
  for (const candidate of identicalCandidates.slice(0, 2)) {
    console.log(`\n👤 Testing candidate: ${candidate.name}`);
    
    const results = [];
    
    // Run 3 matches for the same candidate
    for (let i = 0; i < 3; i++) {
      const matchResponse = await fetch(`${baseUrl}/api/matches/advanced`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          jobId: targetJob.id,
          minMatchPercentage: 0,
          weights: {
            skills: 30,
            experience: 20,
            keywords: 35,
            technicalDepth: 10,
            projectDomain: 5
          },
          prioritizeRecent: false,
          strictMatchMode: false
        })
      });
      
      const matchData = await matchResponse.json();
      const candidateMatch = matchData.matches?.find(m => m.candidateId === candidate.id);
      
      if (candidateMatch) {
        results.push(candidateMatch.matchPercentage);
        console.log(`  Run ${i + 1}: ${candidateMatch.matchPercentage}%`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Check consistency
    const uniqueScores = [...new Set(results)];
    if (uniqueScores.length === 1) {
      console.log(`  ✅ CONSISTENT: All runs returned ${uniqueScores[0]}%`);
    } else {
      console.log(`  ❌ INCONSISTENT: Got different scores: ${results.join(', ')}%`);
      console.log(`  📊 Variance: ${Math.max(...results) - Math.min(...results)}% difference`);
    }
  }
  
  console.log('\n📈 Consistency test completed');
}

// Run the test
testMatchingConsistency().catch(console.error);