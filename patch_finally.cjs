const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

content = content.replace(
  '    } finally {\n      setSearchModalLoading(false);\n    }',
  '    } finally {\n      setSearchModalLoading(false);\n      setSearchModalAiLoading(false);\n    }'
);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
