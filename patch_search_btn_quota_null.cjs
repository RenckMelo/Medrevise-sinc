const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

content = content.replace(
  'if (globalQuota.available < 1) {',
  'if ((globalQuota?.available ?? 0) < 1) {'
);

content = content.replace(
  'disabled={globalQuota.available < 1}',
  'disabled={(globalQuota?.available ?? 0) < 1}'
);

content = content.replace(
  'className="\\${globalQuota.available >= 1',
  'className={`\\${(globalQuota?.available ?? 0) >= 1'
);

content = content.replace(
  'title={globalQuota.available >= 1',
  'title={(globalQuota?.available ?? 0) >= 1'
);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
