const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// The fallback array block spans from line 1538 to 1660. Let's just remove it using regex.
const regex = /\/\/ Ensure we always have a rich selection of at least 12 high quality medical photo options\s+if \(results\.length < 8\) \{[\s\S]*?\}\s+results\.sort\(\(a, b\)/m;
content = content.replace(regex, 'results.sort((a, b)');

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
