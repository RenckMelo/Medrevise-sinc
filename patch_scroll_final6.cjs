const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// Right Column: Make sure the Large Image Frame isn't squeezed to 0 height
content = content.replace(
  '<div className="flex-1 bg-stone-100 rounded-xl overflow-hidden border border-[#E2E0D9] flex items-center justify-center p-2 relative group min-h-[180px] max-h-[300px]">',
  '<div className="shrink-0 bg-stone-100 rounded-xl overflow-hidden border border-[#E2E0D9] flex items-center justify-center p-2 relative group min-h-[180px] max-h-[300px]">'
);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
