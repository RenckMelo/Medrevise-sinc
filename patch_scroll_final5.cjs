const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// Right Column: Make sure the content isn't truncated inside flex-1
content = content.replace(
  '<div className="flex-1 flex flex-col min-h-0 justify-between">',
  '<div className="flex-1 flex flex-col min-h-0 justify-start overflow-y-auto pr-1 pb-2 scrollbar-thin">'
);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
