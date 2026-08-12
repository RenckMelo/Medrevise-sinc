import React, { useState, useRef, useEffect } from 'react';
import { Stethoscope, Send, X, Sparkles, Loader2, Bot, User, HelpCircle, Maximize2, Minimize2, Trash2, GripVertical, BookOpen, BookmarkPlus, Search, ChevronDown, Check, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { generateWithAI, recordUsage } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { markdownComponents, syncSummaryTableOfContents } from '../utils/markdownUtils';
import { db, doc, updateDoc } from '../firebase';

interface Message {
  sender: 'user' | 'preceptor';
  text: string;
  time: string;
}

interface FloatingPreceptorChatProps {
  availableCredits: number;
  topics?: any[];
  subjects?: any[];
  selectedTopic?: any | null;
  userId?: string;
  onTopicUpdate?: (updatedTopic: any) => void;
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

export default function FloatingPreceptorChat({ availableCredits, topics, subjects, selectedTopic, userId, onTopicUpdate }: FloatingPreceptorChatProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'preceptor',
      text: 'Olá, futuro(a) colega! Sou seu Preceptor Médico de Plantão 24/7. Posso analisar condutas, tirar dúvidas ou gerar representações esquemáticas de exames (ECG com supra/infra, gasometrias, laudos de TC/Raio-X, hemogramas, LCR, espirometria, etc.). Como posso ajudar hoje? (Cada dúvida consome 2 créditos).',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Modal State for Importing Chat Answer to Summary
  const [importModalState, setImportModalState] = useState<{
    isOpen: boolean;
    messageText: string;
    customTitle: string;
    selectedTopicId: string;
  }>({
    isOpen: false,
    messageText: '',
    customTitle: '',
    selectedTopicId: ''
  });
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [topicSearchQuery, setTopicSearchQuery] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [isPreviewExpanded, setIsPreviewExpanded] = useState<boolean>(false);

  const handleStartImportToSummary = (msg: Message, msgIndex: number) => {
    let prevUserQuestion = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        prevUserQuestion = messages[i].text;
        break;
      }
    }

    let defaultTitle = '💬 Esclarecimento do Preceptor';
    if (prevUserQuestion) {
      const cleanQ = prevUserQuestion.replace(/[\r\n]+/g, ' ').trim();
      const truncated = cleanQ.length > 40 ? cleanQ.substring(0, 40) + '...' : cleanQ;
      defaultTitle = `💬 Preceptor: ${truncated}`;
    }

    let initialTopicId = selectedTopic?.id || '';
    let initialSubjectId = '';

    if (initialTopicId) {
      const targetT = topics?.find(t => t.id === initialTopicId);
      if (targetT) {
        initialSubjectId = targetT.subjectId || '';
      }
    } else if (topics && topics.length > 0) {
      const defaultTopic = topics[0];
      initialTopicId = defaultTopic.id;
      initialSubjectId = defaultTopic.subjectId || '';
    }

    if (!initialSubjectId && subjects && subjects.length > 0) {
      initialSubjectId = subjects[0].id;
    }

    setSelectedSubjectId(initialSubjectId);
    setIsDropdownOpen(false);
    setTopicSearchQuery('');
    setIsPreviewExpanded(false);
    setImportModalState({
      isOpen: true,
      messageText: msg.text,
      customTitle: defaultTitle,
      selectedTopicId: initialTopicId
    });
  };

  const handleConfirmImport = async () => {
    if (!importModalState.selectedTopicId) {
      alert('Por favor, selecione um tópico de destino para importar.');
      return;
    }
    if (!importModalState.customTitle.trim()) {
      alert('Por favor, digite um título para o novo capítulo.');
      return;
    }

    const targetTopic = topics?.find(t => t.id === importModalState.selectedTopicId);
    if (!targetTopic) {
      alert('Tópico de destino não encontrado.');
      return;
    }

    setIsImporting(true);
    try {
      const cleanTitle = importModalState.customTitle.trim().replace(/^#+\s*/, '');
      const chapterHeader = `## ${cleanTitle}`;
      const todayStr = new Date().toLocaleDateString('pt-BR');

      const importedBlock = `\n\n---\n\n${chapterHeader}\n\n*💡 Conteúdo Importado do PRECEPTOR IA TIRA-DÚVIDAS em ${todayStr}*\n\n${importModalState.messageText}\n\n`;

      const contentFields = [
        'content',
        'content_standard',
        'content_deep',
        'content_elite',
        'content_master',
        'content_monograph',
        'content_custom_analyzed'
      ];

      const updateFields: any = {
        lastUpdated: new Date().toISOString()
      };

      let anyFieldUpdated = false;

      // Update all existing non-empty content fields to ensure consistency regardless of depth
      contentFields.forEach(field => {
        const existingVal = targetTopic[field];
        if (existingVal && existingVal.trim()) {
          const combinedRaw = `${existingVal}${importedBlock}`;
          const syncedContent = syncSummaryTableOfContents(combinedRaw);
          updateFields[field] = syncedContent;
          anyFieldUpdated = true;
        }
      });

      // If no content existed, initialize standard fields
      if (!anyFieldUpdated) {
        const initialContent = `# ${targetTopic.title}\n\n${importedBlock}`;
        const syncedContent = syncSummaryTableOfContents(initialContent);
        updateFields.content = syncedContent;
        updateFields.content_standard = syncedContent;
      }

      if (userId && userId !== 'guest') {
        const topicRef = doc(db, 'users', userId, 'topics', targetTopic.id);
        await updateDoc(topicRef, updateFields);
      }

      const updatedTopic = { ...targetTopic, ...updateFields };
      if (onTopicUpdate) {
        onTopicUpdate(updatedTopic);
      }

      alert(`✅ Capítulo "${cleanTitle}" importado com sucesso para o resumo de "${targetTopic.title}" e adicionado ao Sumário!`);
      setImportModalState(prev => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      console.error('Erro ao importar para resumo:', err);
      alert('Falha ao importar capítulo: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsImporting(false);
    }
  };

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
    // If chat is open, ignore clicks on action buttons inside the header or inputs/textareas
    const targetEl = e.target as HTMLElement;
    if (isOpen) {
      if (targetEl.closest('button') || targetEl.closest('input') || targetEl.closest('textarea')) {
        return;
      }
    }

    // Only drag with primary mouse button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: position.x,
      initialPosY: position.y
    };

    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasMovedRef.current = true;
      }

      setPosition({
        x: dragStartRef.current.initialPosX + dx,
        y: dragStartRef.current.initialPosY + dy
      });
    };

    const handleWindowPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
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

REGRAS DE FORMATAÇÃO E REPRESENTAÇÃO VISUAL DE EXAMES MÉDICOS:
- Quando o estudante solicitar ou a dúvida envolver exames complementares (Eletrocardiograma, Gasometria Arterial, Hemograma, Liquor/LCR, Raio-X, Tomografia, Ecocardiograma, Espirometria, Sumário de Urina, etc.), forneça OBRIGATORIAMENTE um bloco de código estruturado contendo os parâmetros do exame. O sistema ativará automaticamente um INTERPRETADOR E SIMULADOR VISUAL DE ALTA FIDELIDADE:
1. ELETROCARDIOGRAMAS (ECG): Gere bloco de código contendo "ECG" e dados (FC, Ritmo, Eixo, PR, QRS, QTc, Supra/Infradesnivelamento). Ativa simulador vetorial com traçado e papel milimetrado.
2. RADIOLOGIA / IMAGEM (Raio-X, TC, RM, Ultrassom): Gere bloco de código com título do exame, achados por estrutura (Parênquima, Mediastino, Pleura) e Impressão Diagnóstica. Ativa Visualizador PACS/DICOM interativo com diagrama anatômico e janela óssea/térmica.
3. GASOMETRIA ARTERIAL: Gere bloco de código com pH, pCO2, HCO3, PaO2, FiO2, Base Excess e Anion Gap. Ativa Balança de Davenport e Classificação Metabólica/Respiratória.
4. HEMOGRAMA COMPLETO: Gere bloco de código com Hemoglobina (Hb), Hematócrito (Ht), VCM, HCM, Leucócitos, Bastões, Segmentados e Plaquetas. Ativa Painel Hematológico Tri-Série com classificação de anemias e leucograma.
5. LÍQUIDO CEFALORRAQUIDIANO (LCR / LIQUOR): Gere bloco de código com Aspecto, Pressão de Abertura, Células (PMN%), Proteína e Glicose. Ativa Tubo Macroscópico e Perfil Epidemiológico de Meningites.
6. ESPIROMETRIA: Gere bloco de código com VEF1, CVF e VEF1/CVF (Tiffeneau). Ativa Curva Fluxo-Volume vetorial e classificação de Distúrbios Obstrutivos/Restritivos.
7. SUMÁRIO DE URINA (EAS): Gere bloco de código com Leucócitos/campo, Hemácias/campo, Nitrito e Proteínas. Ativa Painel Físico-Químico-Sedimentoscópico com rastreamento de ITU.
- Ao citar íons, fórmulas, gases arteriais ou matemática (ex: Na⁺, HCO₃⁻, K⁺, PaO₂, pCO₂, pH), utilize notação legível bem formatada com KaTeX (ex: $\\text{Na}^+$, $\\text{HCO}_3^-$, $\\text{K}^+$, $\\ge 30\\text{ mm}$) ou símbolos médicos claros.
- Mantenha a resposta extremamente organizada, utilizando marcadores e negritos.

Dúvida do aluno: "${userMsgText}"`;

      const responseText = await generateWithAI(prompt, 'gemini-3.1-flash-lite', 2);

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

  const selectedTopicObj = topics?.find(t => t.id === importModalState.selectedTopicId);
  const filteredTopics = (topics || [])
    .filter(t => t.subjectId === selectedSubjectId)
    .filter(t => (t?.title || '').toLowerCase().includes(topicSearchQuery.toLowerCase()))
    .sort((a, b) => (a?.title || '').localeCompare(b?.title || ''));

  return (
    <div 
      className="fixed bottom-20 2xl:bottom-6 right-4 sm:right-6 z-40 touch-none"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      {/* Floating Button */}
      {!isOpen && (
        <button
          onPointerDown={handlePointerDown}
          onClick={handleButtonClick}
          className="group relative bg-[#1A1A1A] hover:bg-[#D44E3D] text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 cursor-grab active:cursor-grabbing border-2 border-white/20 select-none"
          title="Falar com Preceptor IA (Clique para abrir, segure e arraste para mover)"
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
            className="bg-gradient-to-r from-stone-900 via-indigo-950 to-stone-900 p-4 text-white flex items-center justify-between border-b border-stone-800 cursor-grab active:cursor-grabbing select-none"
            title="Clique e arraste este cabeçalho para mover a janela"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-stone-400 shrink-0" />
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
                    <div>
                      <div className="markdown-body prose prose-xs sm:prose-sm max-w-none text-stone-900 break-words overflow-x-auto leading-relaxed font-sans">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]} 
                          rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: 'ignore' }]]}
                          components={markdownComponents as any}
                        >
                          {formatClinicalMathText(msg.text)}
                        </ReactMarkdown>
                      </div>

                      {index > 0 && (
                        <div className="mt-3.5 pt-2.5 border-t border-stone-100 flex justify-end">
                          <button
                            onClick={() => handleStartImportToSummary(msg, index)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 text-[11px] font-bold transition-all border border-indigo-200 shadow-2xs cursor-pointer select-none"
                            title="Importar esta resposta como um novo capítulo no final do resumo"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Importar para o Resumo
                          </button>
                        </div>
                      )}
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
              placeholder="Dúvida ou solicitação de exame (ex: ECG com supra de ST, Gasometria)..."
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

      {/* Import to Summary Modal */}
      {importModalState.isOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 transition-all duration-300">
          <div className="bg-[#FAF9F5] border border-stone-200/80 rounded-[28px] shadow-2xl shadow-indigo-900/10 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200 relative scrollbar-thin scrollbar-thumb-stone-200">
            
            {/* Header with high contrast and neat layout */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                  <BookmarkPlus className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-base uppercase tracking-wider text-stone-900">
                    Importar para o Resumo
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Adicione esta resposta do Preceptor como um novo capítulo
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setImportModalState(prev => ({ ...prev, isOpen: false }))}
                className="text-stone-400 hover:text-stone-700 p-2 rounded-xl hover:bg-stone-100/80 transition-all cursor-pointer border border-transparent hover:border-stone-200/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form body */}
            <div className="space-y-4">
              
              {/* Select Subject */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-widest font-extrabold text-stone-400">
                  Matéria de Destino
                </label>
                <div className="relative">
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value);
                      setImportModalState(prev => ({ ...prev, selectedTopicId: '' }));
                      setIsDropdownOpen(false);
                    }}
                    className="w-full h-11 px-4 border border-stone-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl text-xs sm:text-sm font-semibold bg-white text-stone-800 transition-all outline-none appearance-none shadow-xs"
                  >
                    <option value="" disabled>Selecione a matéria...</option>
                    {subjects?.slice().sort((a, b) => (a?.name || '').localeCompare(b?.name || '')).map(sub => (
                      <option key={sub.id} value={sub.id}>
                        📚 {sub.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-stone-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Select Topic */}
              <div className="space-y-1.5 relative">
                <label className="block text-[10px] uppercase tracking-widest font-extrabold text-stone-400">
                  Tópico do Resumo
                </label>
                
                {/* Trigger Button */}
                <button
                  type="button"
                  disabled={!selectedSubjectId}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full h-11 px-4 border border-stone-200 hover:border-stone-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl text-xs sm:text-sm font-semibold text-stone-800 transition-all outline-none flex items-center justify-between shadow-xs cursor-pointer bg-white disabled:opacity-50 disabled:bg-stone-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2 truncate">
                    {selectedTopicObj ? (
                      <span className="truncate font-semibold">{selectedTopicObj.title}</span>
                    ) : (
                      <span className="text-stone-400 font-medium">
                        {selectedSubjectId ? "Selecione o tópico..." : "Escolha uma matéria primeiro..."}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-stone-400 transition-transform duration-200", isDropdownOpen && "transform rotate-180")} />
                </button>

                {/* Dropdown Box */}
                {isDropdownOpen && selectedSubjectId && (
                  <div className="absolute top-full left-0 w-full z-50 mt-1.5 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
                    {/* Search Field */}
                    <div className="relative border-b border-stone-100">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        placeholder="Digite para filtrar os tópicos..."
                        value={topicSearchQuery}
                        onChange={(e) => setTopicSearchQuery(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm bg-transparent border-none focus:outline-none focus:ring-0 text-stone-800 font-medium"
                        autoFocus
                      />
                      {topicSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setTopicSearchQuery('')}
                          className="absolute right-3.5 top-3.5 text-stone-400 hover:text-stone-600 p-0.5 rounded-full hover:bg-stone-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Filtered List */}
                    <div className="max-h-48 overflow-y-auto py-1.5 scrollbar-thin scrollbar-thumb-stone-200">
                      {filteredTopics.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-stone-400 text-center italic">
                          Nenhum tópico com resumo para esta matéria
                        </div>
                      ) : (
                        filteredTopics.map(topic => {
                          const isSelected = topic.id === importModalState.selectedTopicId;
                          return (
                            <button
                              key={topic.id}
                              type="button" // Prevent standard form submit issues
                              onClick={() => {
                                setImportModalState(prev => ({ ...prev, selectedTopicId: topic.id }));
                                setIsDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full px-4 py-2.5 text-left text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors hover:bg-indigo-50/50 cursor-pointer",
                                isSelected ? "bg-indigo-50 text-indigo-700" : "text-stone-700 hover:text-stone-900"
                              )}
                            >
                              <span className="truncate pr-2 font-semibold">{topic.title}</span>
                              {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Input Title */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-widest font-extrabold text-stone-400">
                  Título do Novo Capítulo (Será inserido no Sumário)
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Ex: Conduta na Crise Hipertensiva"
                    value={importModalState.customTitle}
                    onChange={(e) => setImportModalState(prev => ({ ...prev, customTitle: e.target.value }))}
                    className="h-11 text-xs sm:text-sm border-stone-200 hover:border-stone-300 focus-visible:ring-indigo-500/20 rounded-2xl font-semibold text-stone-800 bg-white shadow-xs pl-10"
                  />
                  <div className="absolute left-3.5 top-3.5 text-stone-400">
                    <Sparkles className="w-4 h-4 text-indigo-500/70" />
                  </div>
                </div>
              </div>

              {/* Preview Box */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                  className="w-full flex items-center justify-between text-[10px] uppercase tracking-widest font-extrabold text-stone-400 hover:text-stone-600 transition-colors cursor-pointer select-none outline-none"
                >
                  <span>Visualização do Conteúdo do Preceptor</span>
                  <div className="flex items-center gap-1 text-indigo-500 font-bold lowercase">
                    <span>{isPreviewExpanded ? "recolher" : "ver texto completo"}</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isPreviewExpanded && "transform rotate-180")} />
                  </div>
                </button>
                {isPreviewExpanded ? (
                  <div className="bg-amber-50/40 border border-amber-200/60 rounded-2xl p-4 max-h-[220px] overflow-y-auto shadow-xs animate-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-black text-amber-800/80 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                      Resposta do Preceptor
                    </div>
                    <p className="text-[11.5px] text-stone-600 whitespace-pre-line leading-relaxed italic font-serif">
                      {importModalState.messageText}
                    </p>
                  </div>
                ) : (
                  <div 
                    onClick={() => setIsPreviewExpanded(true)}
                    className="bg-stone-50 hover:bg-stone-100/70 border border-stone-200 rounded-2xl px-4 py-3 text-[11px] text-stone-500 cursor-pointer flex items-center justify-between transition-colors shadow-xs"
                  >
                    <span className="truncate max-w-[85%] font-medium italic">
                      "{importModalState.messageText.length > 60 ? importModalState.messageText.substring(0, 60) + '...' : importModalState.messageText}"
                    </span>
                    <span className="text-[10px] font-bold text-indigo-600 shrink-0">Expandir</span>
                  </div>
                )}
              </div>
            </div>

            {/* Note text */}
            <p className="text-[10px] text-stone-400 text-center mt-4">
              * O capítulo será inserido no final do resumo e o sumário interativo será regenerado automaticamente.
            </p>

            {/* Footer Buttons */}
            <div className="flex gap-3 mt-5 pt-4 border-t border-stone-200/60 justify-end">
              <Button
                variant="ghost"
                onClick={() => setImportModalState(prev => ({ ...prev, isOpen: false }))}
                className="h-11 rounded-2xl text-xs font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 border border-stone-200 px-5 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImporting || !importModalState.selectedTopicId || !importModalState.customTitle.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white h-11 px-6 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/15 cursor-pointer disabled:opacity-40 select-none border-none"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando Capítulo...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    Confirmar Importação
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
