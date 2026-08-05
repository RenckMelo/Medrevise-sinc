const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// For the large image
content = content.replace(
  '<div className="flex-1 bg-stone-100 rounded-xl overflow-hidden border border-[#E2E0D9] flex items-center justify-center p-2 relative group min-h-[180px] max-h-[300px]">\n                                <img\n                                  src={selectedItem.url}',
  '<div className="flex-1 bg-stone-100 rounded-xl overflow-hidden border border-[#E2E0D9] flex items-center justify-center p-2 relative group min-h-[180px] max-h-[300px]">\n                                <div className="absolute inset-0 flex items-center justify-center z-0">\n                                  <BookOpen className="w-12 h-12 text-stone-300/50" />\n                                </div>\n                                <img\n                                  src={selectedItem.url}'
);
content = content.replace(
  'className="max-w-full max-h-full object-contain rounded shadow-lg"\n                                  onError={(e) => {\n                                    (e.target as HTMLImageElement).style.display = \'none\';\n                                  }}',
  'className="max-w-full max-h-full object-contain rounded shadow-lg z-10"\n                                  onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth <= 1) (e.target as HTMLImageElement).style.display = \'none\'; }}\n                                  onError={(e) => {\n                                    (e.target as HTMLImageElement).style.display = \'none\';\n                                  }}'
);

// For the thumbnail
content = content.replace(
  '<div className="w-14 h-18 bg-stone-100 rounded-lg overflow-hidden shrink-0 border border-[#E2E0D9]/60 flex items-center justify-center relative">\n                                    <img\n                                      src={item.thumbUrl || item.url}',
  '<div className="w-14 h-18 bg-stone-100 rounded-lg overflow-hidden shrink-0 border border-[#E2E0D9]/60 flex items-center justify-center relative">\n                                    <div className="absolute inset-0 flex items-center justify-center z-0">\n                                      <BookOpen className="w-5 h-5 text-stone-300/60" />\n                                    </div>\n                                    <img\n                                      src={item.thumbUrl || item.url}'
);

content = content.replace(
  'className="w-full h-full object-cover"\n                                      loading="lazy"\n                                      onError={(e) => {\n                                        (e.target as HTMLImageElement).style.display = \'none\';\n                                      }}',
  'className="w-full h-full object-cover z-10"\n                                      loading="lazy"\n                                      onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth <= 1) (e.target as HTMLImageElement).style.display = \'none\'; }}\n                                      onError={(e) => {\n                                        (e.target as HTMLImageElement).style.display = \'none\';\n                                      }}'
);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
