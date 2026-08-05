const fs = require('fs');
let code = fs.readFileSync('src/internato/utils/markdownUtils.tsx', 'utf-8');

const newComponent = `
export const ClinicalFlowchartText = ({ text }: { text: string }) => {
  const lines = text.trim().split('\\n');
  
  // If it's mostly regular text (long paragraphs), just render as Markdown without prose classes that cut it off
  const isRegularText = lines.some(l => l.length > 80 && !l.includes('|') && !l.trim().startsWith('|'));
  if (isRegularText || text.includes('**')) {
    return (
      <div className="p-5 sm:p-6 text-sm text-[#2C2B29] leading-relaxed font-sans w-full overflow-hidden">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkMath]} 
          rehypePlugins={[rehypeRaw, rehypeKatex]}
          components={markdownComponents}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-8 bg-[#FAF9F5] font-sans">
      <div className="flex flex-col max-w-2xl mx-auto">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          
          if (/^\\d+$/.test(trimmed)) {
            return (
              <div key={idx} className="flex justify-center my-3 relative z-10">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D44E3D] text-white font-black text-[11px] shadow-sm ring-4 ring-[#FAF9F5]">
                  {trimmed}
                </span>
              </div>
            );
          }
          
          if (trimmed === '|' || trimmed === '|---|' || trimmed === '│' || (trimmed.startsWith('|') && trimmed.replace(/[-|\\s]/g, '') === '')) {
            return (
              <div key={idx} className="flex justify-center -my-1">
                <div className="w-0.5 h-6 bg-[#E2E0D9]"></div>
              </div>
            );
          }
          
          if (trimmed.startsWith('|') && trimmed.length > 1) {
            const content = trimmed.replace(/^\\|/, '').replace(/\\|$/, '').trim();
            if (!content || content === '---') return (
              <div key={idx} className="flex justify-center -my-1">
                <div className="w-0.5 h-6 bg-[#E2E0D9]"></div>
              </div>
            );
            return (
              <div key={idx} className="flex justify-center my-1 relative z-10 w-full pl-32 sm:pl-48">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-0.5 bg-[#E2E0D9]"></div>
                  <div className="text-[11px] font-bold text-stone-600 bg-white px-3 py-1.5 rounded-lg border border-[#E2E0D9] shadow-sm shadow-stone-100/50">
                    {content}
                  </div>
                </div>
              </div>
            );
          }
          
          if (idx === 0 && trimmed.length < 60) {
            return (
              <div key={idx} className="text-center mb-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#2C2B29] inline-block border-b-2 border-[#D44E3D] pb-1.5">
                  {trimmed.replace(/^\\|/, '').replace(/\\|$/, '').trim()}
                </h4>
              </div>
            );
          }
          
          return (
            <div key={idx} className="bg-white border border-[#E2E0D9] shadow-sm rounded-xl p-4 text-center mx-auto hover:border-stone-300 transition-all relative z-10 w-full max-w-sm my-1">
              <span className="text-[13px] font-bold text-[#2C2B29] leading-snug">
                {trimmed.replace(/^\\|/, '').replace(/\\|$/, '').trim()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
`;

code = code.replace('export const markdownComponents', newComponent + '\nexport const markdownComponents');

fs.writeFileSync('src/internato/utils/markdownUtils.tsx', code);
console.log('done');
