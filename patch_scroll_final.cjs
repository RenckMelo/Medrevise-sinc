const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// 1. Remove the bad onLoad/onError from images
content = content.replace(
  'onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth <= 1) (e.target as HTMLImageElement).src = \'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80\'; }}\n                                  onError={(e) => {\n                                        (e.target as HTMLImageElement).src = \'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80\';\n                                      }}',
  'onError={(e) => {\n                                        (e.target as HTMLImageElement).style.display = \'none\';\n                                      }}'
);

content = content.replace(
  'onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth <= 1) (e.target as HTMLImageElement).src = \'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80\'; }}\n                                  onError={(e) => {\n                                    (e.target as HTMLImageElement).src = \'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80\';\n                                  }}',
  'onError={(e) => {\n                                    (e.target as HTMLImageElement).style.display = \'none\';\n                                  }}'
);

// 2. Fix the scroll layout to be rock solid
content = content.replace(
  '<div className="flex-1 min-h-0 flex flex-col-reverse md:flex-row gap-5 pb-2 overflow-y-auto md:overflow-y-hidden">',
  '<div className="flex-1 min-h-0 flex flex-col-reverse md:flex-row gap-5 pb-2 overflow-y-auto">'
);

content = content.replace(
  '<div className="w-full md:w-[48%] flex flex-col min-h-0 min-h-[300px] h-auto md:h-full md:flex-1">',
  '<div className="w-full md:w-[48%] flex flex-col min-h-[400px] md:min-h-0 md:h-full md:flex-1 shrink-0">'
);

content = content.replace(
  '<div className="flex flex-col md:w-[52%] border-b md:border-b-0 md:border-l border-[#E2E0D9]/80 pb-4 md:pb-0 md:pl-5 mb-4 md:mb-0 min-h-0 shrink-0 md:flex-1 overflow-y-visible md:overflow-y-auto scrollbar-thin">',
  '<div className="flex flex-col md:w-[52%] border-b md:border-b-0 md:border-l border-[#E2E0D9]/80 pb-4 md:pb-0 md:pl-5 mb-4 md:mb-0 shrink-0 md:min-h-0 md:flex-1">'
);

content = content.replace(
  '<div className="flex-1 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin min-h-0 pb-4">',
  '<div className="flex-1 pr-1 space-y-2.5 pb-4">'
);

// 3. Remove the google books zoom removal if it caused black images, wait, 
// the original issue was that I added `imgUrl.replace('&zoom=5', '&zoom=1').replace('&zoom=1', '&zoom=0')`.
// I'll leave the zoom alone, or just replace zoom=5 with zoom=1.
// Let's remove the fallbackAtlas that had the bad image.

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
