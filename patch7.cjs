const fs = require('fs');
let code = fs.readFileSync('src/internato/utils/markdownUtils.tsx', 'utf-8');

const oldComponentRegex = /export const ClinicalFlowchartText = \(\{ text \}: \{ text: string \}\) => \{[\s\S]*?return \([\s\S]*?className="bg-white border border-slate-200 shadow-\[0_1px_4px_rgba\(0,0,0,0\.04\)\] rounded-2xl p-5 sm:p-6 text-center mx-auto hover:border-slate-300 hover:shadow-md transition-all relative z-10 w-full max-w-md my-2"[\s\S]*?<\/div>\s*\);\s*\}\)\}\s*<\/div>\s*<\/div>\s*\);\s*\};/;

const newComponent = `export const ClinicalFlowchartText = ({ text }: { text: string }) => {
  const lines = text.trim().split('\\n');
  
  // A text is a flowchart if it has flowchart structure elements like '|', numbers alone, or arrows.
  const isLikelyFlowchart = lines.some(l => {
    const trimmed = l.trim();
    return trimmed === '|' || trimmed === '|---|' || trimmed === '│' || /^[\\d]+$/.test(trimmed) || (trimmed.startsWith('|') && trimmed.length > 1);
  });
  
  if (!isLikelyFlowchart) {
    return (
      <div className="p-6 sm:p-8 text-[15px] leading-relaxed font-sans w-full text-slate-800">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkMath]} 
          rehypePlugins={[rehypeRaw, rehypeKatex]}
          components={markdownComponents as any}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-10 bg-white font-sans">
      <div className="flex flex-col max-w-2xl mx-auto">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          
          if (/^\\d+$/.test(trimmed)) {
            return (
              <div key={idx} className="flex justify-center my-4 relative z-10">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs shadow-sm ring-4 ring-white">
                  {trimmed}
                </span>
              </div>
            );
          }
          
          if (trimmed === '|' || trimmed === '|---|' || trimmed === '│' || (trimmed.startsWith('|') && trimmed.replace(/[-|\\s]/g, '') === '')) {
            return (
              <div key={idx} className="flex justify-center -my-1.5">
                <div className="w-[1.5px] h-8 bg-slate-200"></div>
              </div>
            );
          }
          
          if (trimmed.startsWith('|') && trimmed.length > 1) {
            const content = trimmed.replace(/^\\|/, '').replace(/\\|$/, '').trim();
            if (!content || content === '---') return (
              <div key={idx} className="flex justify-center -my-1.5">
                <div className="w-[1.5px] h-8 bg-slate-200"></div>
              </div>
            );
            return (
              <div key={idx} className="flex justify-center my-2 relative z-10 w-full pl-28 sm:pl-48">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-[1px] bg-slate-200"></div>
                  <div className="text-[12px] font-medium text-slate-600 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    {content}
                  </div>
                </div>
              </div>
            );
          }
          
          if (idx === 0 && trimmed.length < 60) {
            return (
              <div key={idx} className="text-center mb-8 mt-2">
                <h4 className="text-[13px] font-bold uppercase tracking-[0.15em] text-slate-800 inline-block border-b-2 border-blue-500/30 pb-2">
                  {trimmed.replace(/^\\|/, '').replace(/\\|$/, '').trim()}
                </h4>
              </div>
            );
          }
          
          return (
            <div key={idx} className="bg-white border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.04)] rounded-2xl p-5 sm:p-6 text-center mx-auto hover:border-slate-300 hover:shadow-md transition-all relative z-10 w-full my-2">
              <span className="text-[14px] font-semibold text-slate-800 leading-snug block">
                {trimmed.replace(/^\\|/, '').replace(/\\|$/, '').trim()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};`;

code = code.replace(oldComponentRegex, newComponent);
fs.writeFileSync('src/internato/utils/markdownUtils.tsx', code);
console.log('done');
