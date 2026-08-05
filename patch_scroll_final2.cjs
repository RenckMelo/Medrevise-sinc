const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// Container
content = content.replace(
  '<div className="flex-1 min-h-0 flex flex-col-reverse md:flex-row gap-5 pb-2 overflow-y-auto">',
  '<div className="flex-1 min-h-0 flex flex-col-reverse md:flex-row gap-5 pb-2 overflow-y-auto md:overflow-y-hidden">'
);

// Left Column (List)
content = content.replace(
  '<div className="w-full md:w-[48%] flex flex-col min-h-[400px] md:min-h-0 md:h-full md:flex-1 shrink-0">',
  '<div className="w-full md:w-[48%] flex flex-col md:min-h-0 md:h-full md:flex-1 shrink-0">'
);
content = content.replace(
  '<div className="flex-1 pr-1 space-y-2.5 pb-4">',
  '<div className="flex-1 md:overflow-y-auto pr-1 space-y-2.5 pb-4 scrollbar-thin md:min-h-0">'
);

// Right Column (Preview)
content = content.replace(
  '<div className="flex flex-col md:w-[52%] border-b md:border-b-0 md:border-l border-[#E2E0D9]/80 pb-4 md:pb-0 md:pl-5 mb-4 md:mb-0 shrink-0 md:min-h-0 md:flex-1">',
  '<div className="flex flex-col md:w-[52%] border-b md:border-b-0 md:border-l border-[#E2E0D9]/80 pb-4 md:pb-0 md:pl-5 mb-4 md:mb-0 shrink-0 md:min-h-0 md:flex-1 md:overflow-y-auto scrollbar-thin">'
);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
