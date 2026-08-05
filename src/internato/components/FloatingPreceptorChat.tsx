import React, { useState, useRef, useEffect } from 'react';
import { Stethoscope, Send, X, Sparkles, Loader2, Bot, User, HelpCircle, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { generateWithAI, recordUsage } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { markdownComponents } from '../utils/markdownUtils';

interface Message {
  sender: 'user' | 'preceptor';
  text: string;
  time: string;
}

interface FloatingPreceptorChatProps {
  availableCredits: number;
}

// Pre-process clinical math, ions, and chemical formula text for KaTeX and clean typography
function formatClinicalMathText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\$Na\^\+\$/gi, '$\\text{Na}^+$')
    .replace(/\$Na\^\{\+\}\$/gi, '$\\text{Na}^+$')
    .replace(/\$K\^\+\$/gi, '$\\text{K}^+$')
    .replace(/\$K\^\{\+\}\$/gi, '$\\text{K}^+$')
    .replace(/\$Ca\^\{2\+\}\$/gi, '$\\text{Ca}^{2+}$')
    .replace(/\$Ca\^\+\+\$/gi, '$\\text{Ca}^{2+}$')
    .replace(/\$Cl\^-\$/gi, '$\\text{Cl}^-$')
    .replace(/\$Cl\^\{-\}\$/gi, '$\\text{Cl}^-$')
    .replace(/\$HCO_3\^-\$/gi, '$\\text{HCO}_3^-$')
    .replace(/\$HCO_3\^\{-\}\$/gi, '$\\text{HCO}_3^-$')
    .replace(/\$Mg\^\{2\+\}\$/gi, '$\\text{Mg}^{2+}$')
    .replace(/\$PaO_2\$/gi, '$\\text{PaO}_2$')
    .replace(/\$PaCO_2\$/gi, '$\\text{PaCO}_2$')
    .replace(/\$SaO_2\$/gi, '$\\text{SaO}_2$');
}

export default function FloatingPreceptorChat({ availableCredits }: FloatingPreceptorChatProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'preceptor',
      text: 'Olá, futuro(a) colega! Sou seu Preceptor Médico de Plantão 24/7. Como posso ajudar com seus casos clínicos, condutas ou dúvidas de residência hoje? (Cada dúvida consome 2 créditos).',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Position offset for dragging (x, y relative to initial bottom-right position)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialPosX: number; initialPosY: number }>({
    startX: 0,
    startY: 0,
    initialPosX: 0,
    initialPosY: 0
  });
  const hasMovedRef = useRef<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with primary mouse button / touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: position.x,
      initialPosY: position.y
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMovedRef.current = true;
    }

    setPosition({
      x: dragStartRef.current.initialPosX + dx,
      y: dragStartRef.current.initialPosY + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleButtonClick = () => {
    if (!hasMovedRef.current) {
      setIsOpen(true);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isExpanded]);

  const handleClearHistory = () => {
    setMessages([
      {
        sender: 'preceptor',
        text: 'Histórico de conversa reiniciado. Como posso ajudar com sua próxima dúvida médica?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    if (availableCredits < 2) {
      alert('Créditos insuficientes para consultar o Preceptor IA (necessário 2 créditos).');
      return;
    }

    const userMsgText = input.trim();
    setInput('');

    const userMsg: Message = {
      sender: 'user',
      text: userMsgText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Record usage of 2 credits
      await recordUsage(2);
      window.dispatchEvent(new Event('ai-credits-updated'));

      const prompt = `Você é um Preceptor Médico Sênior e Professor de Residência Médica especialista em provas de residência (ENARE, USP, UNICAMP, SUS-SP, UFG, UnB). Responda à dúvida do estudante de medicina de forma clínica, objetiva, baseada em diretrizes oficiais vigentes, destacando condutas imediatas, exames de escolha e pegadinhas de prova.

Regras importantes de formatação:
- Ao citar íons, fórmulas, gases arteriais ou matemática (ex: Na⁺, HCO₃⁻, K⁺, PaO₂, pCO₂, pH), utilize notação legível bem formatada com KaTeX (ex: $\\text{Na}^+$, $\\text{HCO}_3^-$, $\\text{K}^+$, $\\ge 30\\text{ mm}$) ou símbolos médicos claros.
- Utilize marcadores e negritos para manter a resposta ultra-legível e organizada.

Dúvida do aluno: "${userMsgText}"`;

      const responseText = await generateWithAI(prompt, 'gemini-3.6-flash', 2);

      const preceptorMsg: Message = {
        sender: 'preceptor',
        text: responseText || 'Desculpe, ocorreu uma instabilidade momentânea na preceptoria. Poderia reformular sua dúvida?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, preceptorMsg]);
    } catch (err: any) {
      console.error('Erro no Preceptor IA:', err);
      const errorMsg: Message = {
        sender: 'preceptor',
        text: `⚠️ Erro ao consultar o preceptor: ${err.message || 'Falha de rede'}. Tente novamente.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 touch-none"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      {/* Floating Button */}
      {!isOpen && (
        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleButtonClick}
          className="group relative bg-[#1A1A1A] hover:bg-[#D44E3D] text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 cursor-grab active:cursor-grabbing border-2 border-white/20 select-none"
          title="Falar com Preceptor IA (Arraste para mover)"
        >
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full" />
          <Stethoscope className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div 
          className={cn(
            "bg-white border-2 border-stone-300 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5",
            isExpanded 
              ? "w-[95vw] sm:w-[720px] md:w-[840px] h-[85vh] max-h-[780px]" 
              : "w-[92vw] sm:w-[420px] h-[550px] max-h-[82vh]"
          )}
        >
          {/* Header (Draggable Handle) */}
          <div 
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="bg-gradient-to-r from-stone-900 via-indigo-950 to-stone-900 p-4 text-white flex items-center justify-between border-b border-stone-800 cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/40 border border-indigo-400/50 flex items-center justify-center text-indigo-200 shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-black text-xs sm:text-sm uppercase tracking-wider text-white flex items-center gap-1.5">
                  Preceptor IA • Tira-Dúvidas
                  <span className="bg-indigo-500/30 text-indigo-200 text-[9px] px-2 py-0.5 rounded-full border border-indigo-400/40 font-mono">
                    Plantão 24/7
                  </span>
                </h4>
                <p className="text-[10px] text-stone-300 font-semibold">Residência Médica (2 créditos/msg)</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearHistory}
                className="text-stone-300 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Limpar Histórico"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-stone-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title={isExpanded ? "Reduzir tela" : "Expandir tela"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-stone-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 bg-[#FAF9F5] scrollbar-thin">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-2.5 max-w-[95%] sm:max-w-[88%]",
                  msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-xs",
                  msg.sender === 'user' ? "bg-stone-900 text-white" : "bg-indigo-600 text-white"
                )}>
                  {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={cn(
                  "p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm min-w-0 flex-1 overflow-hidden",
                  msg.sender === 'user' 
                    ? "bg-stone-900 text-white rounded-tr-none font-medium" 
                    : "bg-white text-stone-900 border border-stone-300/90 rounded-tl-none font-sans"
                )}>
                  {msg.sender === 'user' ? (
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  ) : (
                    <div className="markdown-body prose prose-xs sm:prose-sm max-w-none text-stone-900 break-words overflow-x-auto leading-relaxed font-sans">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkMath]} 
                        rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: 'ignore' }]]}
                        components={markdownComponents as any}
                      >
                        {formatClinicalMathText(msg.text)}
                      </ReactMarkdown>
                    </div>
                  )}
                  <span className={cn(
                    "block text-[9px] mt-1.5 text-right font-mono font-semibold",
                    msg.sender === 'user' ? "text-stone-400" : "text-stone-500"
                  )}>
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 mr-auto items-center text-stone-700 bg-white border border-stone-300 px-4 py-3 rounded-2xl text-xs rounded-tl-none shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-800">Preceptor formulando conduta clínica com KaTeX...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-stone-200 flex items-center gap-2">
            <Input
              placeholder="Digite sua dúvida clínica (ex: Na⁺, HCO₃⁻, K⁺, conduta na FA)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="h-11 text-xs sm:text-sm border-stone-300 rounded-xl px-3.5 focus-visible:ring-indigo-600 text-stone-900 font-medium"
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 w-11 p-0 rounded-xl shrink-0 cursor-pointer flex items-center justify-center shadow-md shadow-indigo-200"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
