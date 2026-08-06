import React from 'react';
import { X, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

export default function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
  if (!isOpen) return null;

  const handleRedirectToCheckout = () => {
    window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'profile' }));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#141414]/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <div className="bg-white border-2 border-[#141414] shadow-[10px_10px_0px_0px_rgba(20,20,20,1)] w-full max-w-xl relative p-6 sm:p-8">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 border border-transparent hover:border-[#141414] transition-all cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="space-y-6">
          
          {/* Header */}
          <div className="border-b border-dashed border-[#141414]/15 pb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-150 border border-yellow-300 text-yellow-800 text-[9.5px] font-mono uppercase tracking-widest font-bold mb-3 animate-pulse">
              <Sparkles size={11} className="text-yellow-600" />
              MedRevise Pro
            </div>
            
            {reason ? (
              <div className="bg-amber-50 border border-amber-250 p-3 flex items-start gap-2.5 text-amber-900 mb-2">
                <AlertCircle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                <p className="text-xs font-sans font-medium">{reason}</p>
              </div>
            ) : null}

            <h2 className="font-serif italic text-3xl font-extrabold text-neutral-950">Liberte seu potencial de fixação</h2>
            <p className="text-xs text-neutral-500 font-sans mt-1">Siga o método científico de Ebbinghaus de ponta a ponta sem qualquer restrição de matérias ou simulados.</p>
          </div>

          {/* Matrix of benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-neutral-200 p-4 bg-neutral-50 space-y-3">
              <h4 className="font-mono text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Limite Gratuito</h4>
              <ul className="space-y-2 text-[11px] text-neutral-650">
                <li className="flex items-center gap-1.5 opacity-80">
                  <span className="text-neutral-400">❌</span> Max 3 Matérias
                </li>
                <li className="flex items-center gap-1.5 opacity-80">
                  <span className="text-neutral-400">❌</span> Max 5 Assuntos por Matéria
                </li>
                <li className="flex items-center gap-1.5 opacity-80">
                  <span className="text-neutral-400">❌</span> Apenas 1 Simulado gravado
                </li>
              </ul>
            </div>

            <div className="border-2 border-[#141414] p-4 bg-[#141414]/5 space-y-3 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <h4 className="font-mono text-[10px] uppercase font-bold text-indigo-700 tracking-wider flex items-center gap-1">
                <Sparkles size={11} /> MedRevise Pro
              </h4>
              <ul className="space-y-2 text-[11px] text-neutral-800">
                <li className="flex items-center gap-1.5 font-semibold">
                  <span className="text-emerald-600">✓</span> Matérias Ilimitadas
                </li>
                <li className="flex items-center gap-1.5 font-semibold">
                  <span className="text-emerald-600">✓</span> Assuntos Ilimitados
                </li>
                <li className="flex items-center gap-1.5 font-semibold">
                  <span className="text-emerald-600">✓</span> Simulados Ilimitados
                </li>
                <li className="flex items-center gap-1.5 font-normal text-neutral-600">
                  <span className="text-amber-600">⚡</span> 10 créditos/dia de IA (mesmo limite do Grátis)
                </li>
              </ul>
            </div>
          </div>

          {/* Commercial CTA block */}
          <div className="border border-[#141414] p-5 sm:p-6 bg-slate-50/50 space-y-4">
            <div className="text-center space-y-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">Assinatura Mensal</span>
              <div className="text-2xl font-serif italic text-neutral-900 font-extrabold">R$ 19,90 <span className="text-xs font-normal opacity-60 font-sans">/mês</span></div>
              <p className="text-[10px] font-sans text-neutral-500">Sem taxa de cancelamento ou fidelidade. Pague via Pix ou Cartão.</p>
            </div>

            <div className="space-y-3 pt-2">
              <button 
                onClick={handleRedirectToCheckout}
                className="w-full bg-[#141414] text-white py-4 font-mono font-bold text-xs uppercase tracking-widest hover:bg-[#141414]/95 transition-all flex items-center justify-center gap-2 border border-black shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] cursor-pointer"
              >
                Prosseguir para Checkout Seguro
                <ArrowRight size={14} />
              </button>
              
              <button
                onClick={onClose}
                className="w-full text-center text-xs font-mono text-neutral-400 hover:text-neutral-600 py-1 transition-all cursor-pointer"
              >
                Voltar aos Estudos
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
