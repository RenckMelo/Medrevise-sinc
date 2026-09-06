import React, { useState } from 'react';
import { Stethoscope, CheckCircle2, XCircle, HelpCircle, X, ChevronRight, Sparkles, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface InteractiveClinicalCaseProps {
  title?: string;
  rawText: string;
}

export const InteractiveClinicalCase: React.FC<InteractiveClinicalCaseProps> = ({ title, rawText }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  if (!rawText) return null;

  // Extrair Vinheta, Questão, Alternativas, Gabarito e Raciocínio
  const parseCaseData = (text: string) => {
    let vignette = '';
    let question = '';
    let options: { letter: string; text: string }[] = [];
    let correctLetter = '';
    let reasoning = '';

    // Sanitize text
    const cleanText = text
      .replace(/^> \[\!CASE\]/gi, '')
      .replace(/^>\s*/gm, '')
      .trim();

    // 1. Isolate Gabarito and Reasoning section from options section
    const gabaritoSplitRegex = /(?:\n|^)(?:#{1,4}\s*)?(?:\*\*)?(?:Gabarito|Resposta Correta|Gabarito Oficial|Racioc[íi]nio|Justificativa)/i;
    const gabMatch = cleanText.match(gabaritoSplitRegex);

    let optionsText = cleanText;
    let gabaritoText = '';

    if (gabMatch && gabMatch.index !== undefined) {
      optionsText = cleanText.substring(0, gabMatch.index).trim();
      gabaritoText = cleanText.substring(gabMatch.index).trim();
    }

    // Extract Vinheta
    const vignetteMatch = optionsText.match(/(?:Vinheta Cl[íi]nica|Hist[óo]ria Cl[íi]nica|Caso Cl[íi]nico)[:\s]*([\s\S]*?)(?=(?:Quest[ãa]o|Pergunta|Enunciado|\n-[ \t]*\*\*A\*\*|\n\*\*A\*\*|\n[A-D]\))|$)/i);
    if (vignetteMatch && vignetteMatch[1]) {
      vignette = vignetteMatch[1].trim();
    }

    // Extract Question
    const questionMatch = optionsText.match(/(?:Quest[ãa]o|Pergunta|Enunciado)[:\s]*([\s\S]*?)(?=(?:\n-[ \t]*\*\*A\*\*|\n\*\*A\*\*|\n[A-D]\))|$)/i);
    if (questionMatch && questionMatch[1]) {
      question = questionMatch[1].trim();
    }

    // Extract Options (A, B, C, D)
    const optionMatches = [...optionsText.matchAll(/(?:^|\n)(?:-[ \t]*)?\*\*([A-D])\*\*\)?[:\s]*(.*?)(?=(?:\n(?:-[ \t]*)?\*\*[A-D]\*\*|\n[A-D]\))|$)/gis)];
    if (optionMatches.length > 0) {
      options = optionMatches.map(m => ({
        letter: m[1].toUpperCase(),
        text: m[2].replace(/(?:Gabarito|Racioc[íi]nio|Justificativa)[\s\S]*/i, '').trim()
      }));
    } else {
      // Fallback regex for A), B), C), D) or A. B. C. D.
      const altMatches = [...optionsText.matchAll(/(?:^|\n)(?:-[ \t]*)?([A-D])[\)\.]\s*(.*?)(?=(?:\n(?:-[ \t]*)?[A-D][\)\.])|$)/gis)];
      if (altMatches.length > 0) {
        options = altMatches.map(m => ({
          letter: m[1].toUpperCase(),
          text: m[2].replace(/(?:Gabarito|Racioc[íi]nio|Justificativa)[\s\S]*/i, '').trim()
        }));
      }
    }

    // Extract Correct Letter
    const searchForGab = gabaritoText || cleanText;
    const gabaritoMatch = searchForGab.match(/(?:Gabarito|Resposta Correta|Gabarito Oficial)[:\s]*\**(?:\([A-D]\)|Alternativa\s*|Op[çc][ãa]o\s*)?([A-D])\**/i);
    if (gabaritoMatch && gabaritoMatch[1]) {
      correctLetter = gabaritoMatch[1].toUpperCase();
    }

    // Extract Reasoning / Justification
    const reasoningMatch = searchForGab.match(/(?:Racioc[íi]nio Cl[íi]nico(?:\s*(?:&|e)\s*Justificativa)?|Racioc[íi]nio|Justificativa|Resolu[çc][ãa]o Comentada|Coment[áa]rio)[:\s\*\#]*([\s\S]*?)$/i);
    if (reasoningMatch && reasoningMatch[1]) {
      reasoning = reasoningMatch[1].trim();
    } else {
      // Fallback: take text after Gabarito
      const afterGab = searchForGab.split(/Gabarito Oficial:|Gabarito:/i)[1];
      if (afterGab) {
        reasoning = afterGab.replace(/^[\s\S]*?Alternativa\s*[A-D]\s*/i, '').trim();
      }
    }

    if (reasoning) {
      reasoning = reasoning
        .replace(/^(?:&|e)?\s*(?:Justificativa|Racioc[íi]nio|Coment[áa]rio)[:\s\*\#]*/i, '')
        .replace(/^(?:\*\*)?Alternativa\s*[A-D](?:\*\*)?[:\s]*/i, '')
        .replace(/^[\*\#\>\s]+/g, '')
        .trim();
    }

    return {
      vignette: vignette || optionsText || cleanText,
      question: question || "Com base na vinheta clínica apresentada, qual a conduta ou diagnóstico correto?",
      options: options.length > 0 ? options : [
        { letter: 'A', text: 'Opção A (Consulte o gabarito comentado)' },
        { letter: 'B', text: 'Opção B (Consulte o gabarito comentado)' },
        { letter: 'C', text: 'Opção C (Consulte o gabarito comentado)' },
        { letter: 'D', text: 'Opção D (Consulte o gabarito comentado)' },
      ],
      correctLetter: correctLetter || 'A',
      reasoning: reasoning || 'Consulte o raciocínio médico completo no texto do resumo.'
    };
  };

  const caseData = parseCaseData(rawText);
  const displayTitle = title || "Caso Clínico & Questão Simulada do Capítulo";

  return (
    <>
      {/* Embedded Banner Card in Summary */}
      <div className="my-6 p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-orange-500/10 border-2 border-amber-300/80 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-500/15 text-amber-800 rounded-xl shrink-0 mt-0.5 border border-amber-300/50">
            <Stethoscope className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-amber-300/80">
                Caso Clínico do Capítulo
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-extrabold text-stone-900 mt-1">
              {displayTitle}
            </h4>
            <p className="text-xs text-stone-600 mt-0.5">
              Treine o raciocínio médico ativo com vinheta clínica, questão simulada e resposta comentada.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Abrir Caso Clínico (Popover)</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-80" />
        </button>
      </div>

      {/* Popover / Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-5 sm:p-6 overflow-hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-white border-2 border-stone-200 rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] max-h-[92dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-900 via-amber-950 to-stone-900 p-3.5 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-300 shrink-0">
                  <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold block leading-none mb-0.5">
                    Caso Clínico & Estudo Ativo
                  </span>
                  <h3 className="text-xs sm:text-base font-bold text-white truncate">
                    {displayTitle}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-amber-200 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-stone-800 text-xs sm:text-sm leading-relaxed overscroll-contain">
              {/* Vinheta do Paciente */}
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-amber-700" />
                  <span>Vinheta Clínica</span>
                </div>
                <div className="text-stone-800 text-xs sm:text-sm leading-relaxed font-medium">
                  <ReactMarkdown>{caseData.vignette}</ReactMarkdown>
                </div>
              </div>

              {/* Pergunta */}
              <div className="bg-amber-100/90 border-2 border-amber-300/80 text-amber-950 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-2xs space-y-1">
                <span className="text-amber-900 font-mono text-[10px] uppercase tracking-wider font-black block flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Pergunta da Prova</span>
                </span>
                <p className="font-extrabold text-stone-900 text-xs sm:text-sm leading-relaxed">
                  {caseData.question}
                </p>
              </div>

              {/* Alternativas */}
              <div className="space-y-2.5 pt-1">
                <span className="text-xs font-extrabold text-stone-800 uppercase tracking-wide block">
                  Selecione a Alternativa Correta:
                </span>
                <div className="space-y-2">
                  {caseData.options.map((opt) => {
                    const isSelected = selectedOption === opt.letter;
                    const isCorrect = opt.letter === caseData.correctLetter;

                    let cardStyle = "bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100 hover:border-stone-300";
                    if (showAnswer) {
                      if (isCorrect) {
                        cardStyle = "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/20";
                      } else if (isSelected) {
                        cardStyle = "bg-rose-50 border-rose-400 text-rose-950 font-medium";
                      } else {
                        cardStyle = "bg-stone-50 border-stone-200 opacity-60 text-stone-600";
                      }
                    }

                    return (
                      <button
                        key={opt.letter}
                        type="button"
                        onClick={() => {
                          setSelectedOption(opt.letter);
                          setShowAnswer(true);
                        }}
                        className={`w-full p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${cardStyle}`}
                      >
                        <div className={`w-6 h-6 rounded-xl flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${
                          showAnswer && isCorrect
                            ? 'bg-emerald-600 text-white'
                            : showAnswer && isSelected && !isCorrect
                            ? 'bg-rose-600 text-white'
                            : 'bg-stone-200 text-stone-700'
                        }`}>
                          {opt.letter}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5 text-xs sm:text-sm">
                          {opt.text}
                        </div>
                        {showAnswer && isCorrect && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 self-center" />
                        )}
                        {showAnswer && isSelected && !isCorrect && (
                          <XCircle className="w-5 h-5 text-rose-600 shrink-0 self-center" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle ou Exibição do Raciocínio Clínico */}
              {!showAnswer ? (
                <button
                  type="button"
                  onClick={() => setShowAnswer(true)}
                  className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl border border-stone-200 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Revelar Gabarito Direto sem Selecionar</span>
                </button>
              ) : (
                <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-emerald-50/30 border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md font-mono uppercase">
                        Gabarito Oficial: Alternativa {caseData.correctLetter}
                      </span>
                    </div>
                    {selectedOption && (
                      <span className={`text-xs font-bold ${selectedOption === caseData.correctLetter ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {selectedOption === caseData.correctLetter ? '✓ Você acertou!' : '✗ Alternativa incorreta'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <h5 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Raciocínio Clínico & Justificativa Médica:
                    </h5>
                    <div className="text-stone-800 text-xs sm:text-sm leading-relaxed space-y-2 font-medium">
                      <ReactMarkdown>{caseData.reasoning}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 bg-stone-50 border-t border-stone-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
              >
                Concluir Estudo do Caso
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
