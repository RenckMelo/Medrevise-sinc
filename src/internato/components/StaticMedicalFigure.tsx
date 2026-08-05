import React from 'react';
import { Search, ExternalLink, Eye, RotateCw, Trash2, Link, BookOpen, AlertCircle } from 'lucide-react';

interface StaticMedicalFigureProps {
  description: string;
  originalAlt: string;
  onTryAnother?: () => void;
  isSearchingAlternatives?: boolean;
  onSubstituir?: () => void;
  onOcultar?: () => void;
  onExcluirCaixa?: () => void;
}

export const StaticMedicalFigure: React.FC<StaticMedicalFigureProps> = ({ 
  description, 
  originalAlt,
  onTryAnother,
  isSearchingAlternatives = false,
  onSubstituir,
  onOcultar,
  onExcluirCaixa
}) => {
  // Pre-configured medical search URLs
  const searchGoogleImages = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(description + " medicine book atlas illustration")}`;
  const searchPubMed = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(description)}`;

  return (
    <span className="block my-6 max-w-full text-center">
      <span className="inline-block w-full max-w-xl bg-white border border-[#E2E0D9] rounded-2xl p-6 shadow-sm text-left">
        <span className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-stone-600" />
          <span className="text-[10px] font-bold font-mono text-stone-600 uppercase tracking-wider">
            Referência de Livro de Medicina
          </span>
        </span>
        
        {/* Simple and clean notification alert */}
        <div className="rounded-xl bg-[#FBFBFA] border border-[#E2E0D9] p-5 flex items-start gap-3.5 mb-4">
          <AlertCircle className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="block text-xs font-bold text-stone-800 font-sans">
              Imagem de referência não carregou automaticamente
            </span>
            <span className="block text-[11px] text-stone-500 font-sans leading-relaxed">
              Tentamos buscar uma imagem de livro de medicina correspondente a <strong className="text-stone-700">"{originalAlt || description}"</strong>, mas ela está inacessível ou não pôde ser validada.
            </span>
          </div>
        </div>

        <span className="block px-1">
          <span className="block text-xs font-bold text-gray-800 font-sans mb-1">
            Assunto: {originalAlt || description || "Ilustração médica"}
          </span>
          <span className="block text-[11px] text-gray-500 leading-relaxed font-sans mb-4">
            <span className="font-semibold text-gray-600">Descrição Clínica:</span> {description || "Referência visual de domínio público para fins exclusivamente didáticos."}
          </span>
          
          <span className="block pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400 font-sans font-medium">
              <Eye className="w-3.5 h-3.5 animate-pulse" />
              Insira sua imagem personalizada se desejar.
            </span>
            <span className="flex flex-wrap gap-2">
              {onTryAnother && (
                <button
                  type="button"
                  onClick={onTryAnother}
                  disabled={isSearchingAlternatives}
                  className="flex items-center gap-1 px-2.5 py-1.5 font-sans font-bold text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                  title="Buscar uma imagem alternativa válida do acervo"
                >
                  <RotateCw className={`w-3 h-3 ${isSearchingAlternatives ? 'animate-spin' : ''}`} />
                  {isSearchingAlternatives ? 'Buscando...' : 'Tentar outra imagem'}
                </button>
              )}
              {onSubstituir && (
                <button
                  type="button"
                  onClick={onSubstituir}
                  className="flex items-center gap-1 px-2.5 py-1.5 font-sans font-bold text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  <Link className="w-3.5 h-3.5" />
                  Substituir Imagem
                </button>
              )}
              {onExcluirCaixa && (
                <button
                  type="button"
                  onClick={onExcluirCaixa}
                  className="flex items-center gap-1 px-2.5 py-1.5 font-sans font-bold text-[10px] text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all active:scale-95 cursor-pointer"
                  title="Excluir esta foto e remover completamente a caixa do resumo"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  Excluir Foto e Caixa
                </button>
              )}
              {onOcultar && (
                <button
                  type="button"
                  onClick={onOcultar}
                  className="flex items-center gap-1 px-2.5 py-1.5 font-sans font-bold text-[10px] text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  Ocultar
                </button>
              )}
              <button
                type="button"
                onClick={() => window.open(searchGoogleImages, '_blank')}
                className="flex items-center gap-1 px-2.5 py-1.5 font-sans font-semibold text-[10px] text-stone-600 bg-[#E4E3E0]/20 hover:bg-[#141414]/5 border border-neutral-300 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                <Search className="w-3 h-3" />
                Buscar Imagem Real
              </button>
              <button
                type="button"
                onClick={() => window.open(searchPubMed, '_blank')}
                className="flex items-center gap-1 px-2.5 py-1.5 font-sans font-semibold text-[10px] text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                PubMed
              </button>
            </span>
          </span>
        </span>
      </span>
    </span>
  );
};
