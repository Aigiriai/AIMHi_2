const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server/routes.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all occurrences of the old pattern with the new one
content = content.replace(
  /const { db } = await getDatabase\(\); const schema = await import\('\.\.\/unified-schema'\);/g,
  'const { db, schema } = await getDB();'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Updated all getDatabase() calls to use getDB()');
