const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// Fix the duplicate onLoad
content = content.replace(
  'onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth <= 1) (e.target as HTMLImageElement).src = \'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80\'; }}\n                                  onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth <= 1) (e.target as HTMLImageElement).src = \'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80\'; }}\n                                  onError={(e) => {',
  'onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth <= 1) (e.target as HTMLImageElement).src = \'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80\'; }}\n                                  onError={(e) => {'
);

// Now patch the preview image (which is further down, we can just replace all occurrences that don't have onLoad already)
content = content.replace(
  'className="max-w-full max-h-full object-contain rounded shadow-lg"\n                                  onError={(e) => {',
  'className="max-w-full max-h-full object-contain rounded shadow-lg"\n                                  onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth <= 1) (e.target as HTMLImageElement).src = \'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80\'; }}\n                                  onError={(e) => {'
);
fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
