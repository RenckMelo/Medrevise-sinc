import React, { useState } from 'react';
import { db, collection, addDoc } from '../firebase';
import { 
  Lightbulb, 
  Send, 
  X, 
  CheckCircle2, 
  Loader2, 
  MessageSquare, 
  AlertCircle,
  Stethoscope,
  Bug,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuggestionsBoxProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
  userId?: string;
}

export default function SuggestionsBox({ isOpen, onClose, userEmail, userId }: SuggestionsBoxProps) {
  const [category, setCategory] = useState<'sugestao_funcionalidade' | 'dica_conteudo' | 'relato_erro' | 'outro'>('sugestao_funcionalidade');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(userEmail || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg('Por favor, digite sua dica ou sugestão antes de enviar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await addDoc(collection(db, 'suggestions'), {
        category,
        subject: subject.trim() || 'Sugestão sem título',
        message: message.trim(),
        userEmail: email.trim() || userEmail || 'anônimo',
        userId: userId || 'guest',
        createdAt: new Date().toISOString(),
        status: 'pending'
      });

      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setMessage('');
        setSubject('');
        onClose();
      }, 3000);
    } catch (err) {
      console.error('Erro ao enviar sugestão:', err);
      setIsSubmitting(false);
      setErrorMsg('Ocorreu um erro ao enviar sua mensagem. Tente novamente.');
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-[#E2E0D9] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-auto relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A1A1A] to-[#2D2A26] p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D44E3D]/20 border border-[#D44E3D]/40 flex items-center justify-center text-[#D44E3D] shrink-0">
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight font-display flex items-center gap-2">
                Dicas & Sugestões
                <span className="text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  MedInternato
                </span>
              </h3>
              <p className="text-[11px] text-[#A3A09A] font-medium mt-0.5">
                Envie suas ideias de melhoria, dicas de estudo ou feedback
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {isSuccess ? (
            <div className="py-8 flex flex-col items-center text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-[#1A1A1A] font-display">Sugestão Enviada com Sucesso!</h4>
              <p className="text-xs text-[#6E6A62] max-w-sm leading-relaxed">
                Muito obrigado por contribuir com a evolução do <strong>MedInternato</strong>! Sua dica foi registrada diretamente para nossa equipe médica e de desenvolvimento.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6E6A62] mb-1.5">
                  Tipo de Mensagem
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'sugestao_funcionalidade', label: 'Sugestão / Ideia', icon: Sparkles, color: 'text-amber-600 bg-amber-50' },
                    { id: 'dica_conteudo', label: 'Dica Médico-Acadêmica', icon: Stethoscope, color: 'text-emerald-600 bg-emerald-50' },
                    { id: 'relato_erro', label: 'Relatar Problema', icon: Bug, color: 'text-rose-600 bg-rose-50' },
                    { id: 'outro', label: 'Outros Feedback', icon: MessageSquare, color: 'text-blue-600 bg-blue-50' }
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setCategory(cat.id as any)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                          isSelected 
                            ? 'border-[#D44E3D] bg-[#D44E3D]/5 text-[#1A1A1A] shadow-xs' 
                            : 'border-[#E2E0D9] bg-white text-[#6E6A62] hover:bg-[#FAF9F6]'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg ${cat.color} shrink-0`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject Title */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6E6A62] mb-1">
                  Título da Sugestão <span className="text-stone-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Adicionar filtro por banco de questões ou tema X"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#E2E0D9] text-xs text-[#1A1A1A] placeholder:text-stone-400 focus:outline-none focus:border-[#D44E3D] focus:bg-white transition-all font-medium"
                />
              </div>

              {/* Detailed Message */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6E6A62] mb-1">
                  Sua Dica / Detalhes da Sugestão <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descreva detalhadamente sua sugestão, recurso desejado ou sugestão de conteúdo médico..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#E2E0D9] text-xs text-[#1A1A1A] placeholder:text-stone-400 focus:outline-none focus:border-[#D44E3D] focus:bg-white transition-all font-medium leading-relaxed resize-none"
                />
              </div>

              {/* Email (Optional) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6E6A62] mb-1">
                  Seu E-mail de Contato
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF9F6] border border-[#E2E0D9] text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D44E3D] focus:bg-white transition-all font-medium"
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E2E0D9]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="text-xs font-bold text-[#6E6A62] hover:bg-[#FAF9F6] rounded-xl h-10 px-4"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#D44E3D] hover:bg-[#b83f30] text-white font-bold text-xs rounded-xl h-10 px-5 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar Dica / Sugestão</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
