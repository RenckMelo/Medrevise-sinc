const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// Right Column: Remove overflow-y-auto so the image container expands
content = content.replace(
  '<div className="flex flex-col md:w-[52%] border-b md:border-b-0 md:border-l border-[#E2E0D9]/80 pb-4 md:pb-0 md:pl-5 mb-4 md:mb-0 h-[45%] min-h-[200px] shrink-0 md:min-h-0 md:flex-1 overflow-y-auto scrollbar-thin">',
  '<div className="flex flex-col md:w-[52%] border-b md:border-b-0 md:border-l border-[#E2E0D9]/80 pb-4 md:pb-0 md:pl-5 mb-4 md:mb-0 h-[45%] min-h-[200px] shrink-0 md:min-h-0 md:flex-1">'
);

// Inner scroll container for text below the image (or just let the whole thing flex)
// Wait, the "flex-1 flex flex-col min-h-0 justify-between" might need to handle overflow.
// Actually, let's just make the preview container robust.

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
