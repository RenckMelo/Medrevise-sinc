const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

content = content.replace(
  '  const [searchModalLoading, setSearchModalLoading] = useState(false);',
  '  const [searchModalLoading, setSearchModalLoading] = useState(false);\n  const [searchModalAiLoading, setSearchModalAiLoading] = useState(false);\n  const [aiCredits, setAiCredits] = useState(() => { return parseInt(localStorage.getItem(\'pref_ai_credits\') || \'50\', 10); });'
);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
