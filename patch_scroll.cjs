const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// Parent container
content = content.replace(
  '<div className="flex-1 min-h-0 flex flex-col md:flex-row gap-5 pb-2">',
  '<div className="flex-1 min-h-0 flex flex-col md:flex-row gap-5 pb-2 overflow-y-auto md:overflow-y-hidden">'
);

// Child 1 (Left column) - remove h-[280px] and add h-auto
content = content.replace(
  '<div className="w-full md:w-[48%] flex flex-col min-h-0 h-[280px] md:h-auto md:flex-1">',
  '<div className="w-full md:w-[48%] flex flex-col min-h-0 h-auto md:h-full md:flex-1">'
);

// Child 1 inner scroll container
content = content.replace(
  '<div className="flex-1 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin min-h-0 pb-4">',
  '<div className="flex-1 overflow-y-visible md:overflow-y-auto pr-1 space-y-2.5 scrollbar-thin min-h-0 pb-4">'
);

// Child 2 (Right column)
content = content.replace(
  '<div className="flex flex-col md:w-[52%] border-t md:border-t-0 md:border-l border-[#E2E0D9]/80 pt-4 md:pt-0 md:pl-5 min-h-0 flex-1 overflow-y-auto scrollbar-thin">',
  '<div className="flex flex-col md:w-[52%] border-t md:border-t-0 md:border-l border-[#E2E0D9]/80 pt-4 md:pt-0 md:pl-5 min-h-0 flex-1 overflow-y-visible md:overflow-y-auto scrollbar-thin">'
);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
