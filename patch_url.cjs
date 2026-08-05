const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');
content = content.replace(
  'imgUrl = imgUrl.replace(\'http://\', \'https://\');',
  'imgUrl = imgUrl.replace(\'http://\', \'https://\').replace(\'&edge=curl\', \'\').replace(\'&zoom=5\', \'&zoom=1\').replace(\'&zoom=1\', \'&zoom=0\');'
);
fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
