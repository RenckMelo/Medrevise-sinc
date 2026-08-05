const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

content = content.replace(
  'className="\\${globalQuota.available >= 1 ? \\\'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800\\\' : \\\'bg-stone-300\\\'} text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"',
  'className={`\\${(globalQuota?.available ?? 0) >= 1 ? \\\'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800\\\' : \\\'bg-stone-300\\\'} text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed`}'
);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
