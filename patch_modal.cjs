const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// 1. Fix the Google Books URL zoom level that caused black images
content = content.replace(
  'imgUrl = imgUrl.replace(\'http://\', \'https://\').replace(\'&edge=curl\', \'\').replace(\'&zoom=5\', \'&zoom=1\').replace(\'&zoom=1\', \'&zoom=0\');',
  'imgUrl = imgUrl.replace(\'http://\', \'https://\').replace(\'&edge=curl\', \'\');'
);
content = content.replace(
  'imgUrl = imgUrl.replace(\'http://\', \'https://\').replace(\'&edge=curl\', \'\');',
  'imgUrl = imgUrl.replace(\'http://\', \'https://\').replace(\'&edge=curl\', \'\');' // idempotency
);

// 2. Change the layout to show preview AT THE TOP on mobile, list AT THE BOTTOM
content = content.replace(
  '<div className="flex-1 min-h-0 flex flex-col md:flex-row gap-5 pb-2 overflow-y-auto md:overflow-y-hidden">',
  '<div className="flex-1 min-h-0 flex flex-col-reverse md:flex-row gap-5 pb-2 overflow-y-auto md:overflow-y-hidden">'
);

// 3. Fix the Left Column to scroll properly on mobile with a max height
content = content.replace(
  '<div className="w-full md:w-[48%] flex flex-col min-h-0 h-auto md:h-full md:flex-1">',
  '<div className="w-full md:w-[48%] flex flex-col min-h-0 min-h-[300px] h-auto md:h-full md:flex-1">'
);

content = content.replace(
  '<div className="flex-1 overflow-y-visible md:overflow-y-auto pr-1 space-y-2.5 scrollbar-thin min-h-0 pb-4">',
  '<div className="flex-1 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin min-h-0 pb-4">'
);

// 4. Ensure right column is properly sized
content = content.replace(
  '<div className="flex flex-col md:w-[52%] border-t md:border-t-0 md:border-l border-[#E2E0D9]/80 pt-4 md:pt-0 md:pl-5 min-h-0 flex-1 overflow-y-visible md:overflow-y-auto scrollbar-thin">',
  '<div className="flex flex-col md:w-[52%] border-b md:border-b-0 md:border-l border-[#E2E0D9]/80 pb-4 md:pb-0 md:pl-5 mb-4 md:mb-0 min-h-0 shrink-0 md:flex-1 overflow-y-visible md:overflow-y-auto scrollbar-thin">'
);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
