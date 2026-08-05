const fs = require('fs');
let code = fs.readFileSync('src/internato/utils/markdownUtils.tsx', 'utf-8');

const oldComponent = `export const ClinicalFlowchartText = ({ text }: { text: string }) => {
  const lines = text.trim().split('\\n');
  
  // If it's mostly regular text (long paragraphs), just render as Markdown without prose classes that cut it off
  const isRegularText = lines.some(l => l.length > 80 && !l.includes('|') && !l.trim().startsWith('|'));
  if (isRegularText || text.includes('**')) {
    return (
      <div className="p-6 sm:p-8 text-[15px] text-[#3A3935] leading-relaxed font-sans w-full">
        <div className="prose prose-stone max-w-none prose-p:leading-[1.7] prose-p:mb-5 prose-li:my-2 prose-strong:font-bold prose-strong:text-[#1A1918] marker:text-[#8C8B88]">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]} 
            rehypePlugins={[rehypeRaw, rehypeKatex]}
          >
            {text}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-10 bg-[#FAF9F5] font-sans">
      <div className="flex flex-col max-w-2xl mx-auto">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          
          if (/^\\d+$/.test(trimmed)) {
            return (
              <div key={idx} className="flex justify-center my-4 relative z-10">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#C25B4E] text-white font-black text-xs shadow-sm ring-4 ring-[#FAF9F5]">
                  {trimmed}
                </span>
              </div>
            );
          }
          
          if (trimmed === '|' || trimmed === '|---|' || trimmed === '│' || (trimmed.startsWith('|') && trimmed.replace(/[-|\\s]/g, '') === '')) {
            return (
              <div key={idx} className="flex justify-center -my-1.5">
                <div className="w-0.5 h-8 bg-[#E2E0D9]"></div>
              </div>
            );
          }
          
          if (trimmed.startsWith('|') && trimmed.length > 1) {
            const content = trimmed.replace(/^\\|/, '').replace(/\\|$/, '').trim();
            if (!content || content === '---') return (
              <div key={idx} className="flex justify-center -my-1.5">
                <div className="w-0.5 h-8 bg-[#E2E0D9]"></div>
              </div>
            );
            return (
              <div key={idx} className="flex justify-center my-2 relative z-10 w-full pl-28 sm:pl-48">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-[1px] bg-[#D4D2C9]"></div>
                  <div className="text-[12px] font-medium text-[#5C5A56] bg-white px-4 py-2 rounded-xl border border-[#E2E0D9] shadow-sm">
                    {content}
                  </div>
                </div>
              </div>
            );
          }
          
          if (idx === 0 && trimmed.length < 60) {
            return (
              <div key={idx} className="text-center mb-8 mt-2">
                <h4 className="text-[13px] font-black uppercase tracking-[0.15em] text-[#1A1918] inline-block border-b-2 border-[#C25B4E]/40 pb-2">
                  {trimmed.replace(/^\\|/, '').replace(/\\|$/, '').trim()}
                </h4>
              </div>
            );
          }
          
          return (
            <div key={idx} className="bg-white border border-[#E8E6E1] shadow-sm rounded-2xl p-5 sm:p-6 text-center mx-auto hover:border-[#D4D2C9] hover:shadow transition-all relative z-10 w-full max-w-md my-2">
              <span className="text-[14px] font-semibold text-[#1A1918] leading-snug block">
                {trimmed.replace(/^\\|/, '').replace(/\\|$/, '').trim()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};`;

const newComponent = `export const ClinicalFlowchartText = ({ text }: { text: string }) => {
  const lines = text.trim().split('\\n');
  
  // If it's mostly regular text (long paragraphs), just render as Markdown without prose classes that cut it off
  const isRegularText = lines.some(l => l.length > 80 && !l.includes('|') && !l.trim().startsWith('|'));
  if (isRegularText || text.includes('**') || text.includes('$')) {
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
            <div key={idx} className="bg-white border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.04)] rounded-2xl p-5 sm:p-6 text-center mx-auto hover:border-slate-300 hover:shadow-md transition-all relative z-10 w-full max-w-md my-2">
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

code = code.replace(oldComponent, newComponent);

const oldOuter = `    if (isLightTextType) {
      return (
        <div className="my-8 border border-[#E2E0D9] bg-[#FAF9F5] rounded-[24px] shadow-sm">
          <div className="bg-white/50 border-b border-[#E2E0D9]/60 px-6 py-4 flex items-center justify-between rounded-t-[24px]">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#F5F2EB] border border-[#E8E6E1]">
                <Activity className="w-3.5 h-3.5 text-[#C25B4E]" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#4A4947]">
                Nota Clínica
              </span>
            </div>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#E8E6E1]" />
              <div className="w-2 h-2 rounded-full bg-[#D4D2C9]" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-b-[24px]">
            <ClinicalFlowchartText text={codeContent} />
          </div>
        </div>
      );
    }`;

const newOuter = `    if (isLightTextType) {
      return (
        <div className="my-10 border border-slate-200 bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-sm">
                <Stethoscope className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-bold tracking-wide text-slate-700">
                Resumo Clínico
              </span>
            </div>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-200" />
              <div className="w-2 h-2 rounded-full bg-slate-200" />
              <div className="w-2 h-2 rounded-full bg-slate-200" />
            </div>
          </div>
          <div className="w-full break-words">
            <ClinicalFlowchartText text={codeContent} />
          </div>
        </div>
      );
    }`;

code = code.replace(oldOuter, newOuter);
fs.writeFileSync('src/internato/utils/markdownUtils.tsx', code);
console.log('done');
