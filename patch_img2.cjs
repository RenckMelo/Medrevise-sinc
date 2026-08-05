const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');
content = content.replace(
  'onError={(e) => {',
  'onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth <= 1) (e.target as HTMLImageElement).src = \'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80\'; }}\n                                  onError={(e) => {'
);
fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
