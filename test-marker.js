// Test script to validate the fresh production marker
const fs = require('fs');
const path = require('path');

const markerPath = path.join(__dirname, 'data', '.fresh-production-required');

console.log('🔍 Testing fresh production marker...');
console.log(`📁 Marker path: ${markerPath}`);

if (!fs.existsSync(markerPath)) {
  console.log('❌ Marker file does not exist');
  process.exit(1);
}

try {
  const content = fs.readFileSync(markerPath, 'utf-8');
  console.log('📄 Raw content:');
  console.log(content);
  
  const parsed = JSON.parse(content);
  console.log('✅ JSON parsed successfully:');
  console.log(JSON.stringify(parsed, null, 2));
  
  console.log('\n🎯 Marker validation passed!');
} catch (error) {
  console.error('❌ Marker validation failed:', error.message);
  process.exit(1);
}
