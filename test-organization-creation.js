// Test script to verify organization creation works
const testOrganizationCreation = async () => {
  const baseUrl = 'http://localhost:5000';
  
  try {
    // First login as super admin
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'superadmin@aimhi.app',
        password: 'SuperAdmin123!@#',
        organizationName: 'AIM Hi System'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    console.log('✅ Super admin login successful');
    
    // Test 1: Create organization using the old API
    console.log('\n🧪 Testing organization creation (old API)...');
    const createOrgResponse = await fetch(`${baseUrl}/api/auth/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Test Organization 1',
        domain: 'test1.example.com',
        plan: 'trial',
        adminEmail: 'admin@test1.com',
        adminFirstName: 'John',
        adminLastName: 'Doe',
        adminPassword: 'TestPassword123!'
      })
    });
    
    if (!createOrgResponse.ok) {
      const error = await createOrgResponse.text();
      throw new Error(`Organization creation failed: ${createOrgResponse.status} - ${error}`);
    }
    
    const orgData = await createOrgResponse.json();
    console.log('✅ Organization created successfully:', {
      id: orgData.organization.id,
      name: orgData.organization.name,
      subdomain: orgData.organization.subdomain
    });
    
    // Test 2: Create organization using the invite API
    console.log('\n🧪 Testing organization creation (invite API)...');
    const inviteResponse = await fetch(`${baseUrl}/api/auth/invite-organization-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        organizationName: 'Test Organization 2',
        website: 'test2.example.com',
        industry: 'Technology',
        size: '10-50',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'admin@test2.com',
        phone: '+1234567890'
      })
    });
    
    if (!inviteResponse.ok) {
      const error = await inviteResponse.text();
      throw new Error(`Invite organization admin failed: ${inviteResponse.status} - ${error}`);
    }
    
    const inviteData = await inviteResponse.json();
    console.log('✅ Organization created via invite successfully:', {
      id: inviteData.organization.id,
      name: inviteData.organization.name,
      subdomain: inviteData.organization.subdomain,
      temporaryCredentials: inviteData.temporaryCredentials
    });
    
    // Test 3: List organizations
    console.log('\n🧪 Testing organization listing...');
    const listResponse = await fetch(`${baseUrl}/api/auth/organizations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!listResponse.ok) {
      const error = await listResponse.text();
      throw new Error(`Organization listing failed: ${listResponse.status} - ${error}`);
    }
    
    const listData = await listResponse.json();
    console.log('✅ Organization listing successful:', {
      count: listData.organizations.length,
      names: listData.organizations.map(org => org.name)
    });
    
    console.log('\n🎉 All tests passed! Organization creation is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
};

// Run the test
testOrganizationCreation();