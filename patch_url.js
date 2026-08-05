const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');
content = content.replace(
  'imgUrl = imgUrl.replace(\'http://\', \'https://\');',
  'imgUrl = imgUrl.replace(\'http://\', \'https://\').replace(\'&edge=curl\', \'\');'
);
fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
