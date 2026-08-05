import React, { useState, useMemo } from 'react';
import { 
  HelpCircle, 
  Search, 
  X, 
  Calendar, 
  HelpCircle as QuestionIcon, 
  Brain, 
  ArrowLeftRight, 
  Sparkles, 
  CheckCircle2, 
  ChevronDown, 
  BookOpen, 
  BarChart3, 
  MessageSquare,
  ShieldCheck,
  Zap,
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FAQItem {
  id: string;
  category: 'planejamento' | 'questoes' | 'revisoes' | 'vinculo' | 'ia' | 'geral';
  question: string;
  answer: string;
  highlights?: string[];
  icon: any;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 'plan-1',
    category: 'planejamento',
    question: 'Como funciona e como criar o meu Planejamento de Estudos?',
    answer: 'O Planejamento (Cronograma) organiza de forma automatizada e personalizada toda a sua rotina de estudos para o internato e provas de residência médica (ENARE, USP, PSU, etc.). Ao criar um planejamento, a plataforma calcula as horas disponíveis, distribui as matérias por incidência em provas e organiza a sequência de tópicos semanal ou diariamente. Você pode marcar tópicos como concluídos, praticar questões associadas e acompanhar sua taxa de cobertura em tempo real.',
    highlights: [
      'Gere planejamentos personalizados em poucos segundos com base na sua prova-alvo.',
      'Defina se prefere organização por dias da semana ou por semanas sequenciais.',
      'Acompanhe o gráfico de progresso e porcentagem de cobertura da edital.'
    ],
    icon: Calendar
  },
  {
    id: 'quest-1',
    category: 'questoes',
    question: 'Como utilizar o banco e a função de Questões?',
    answer: 'Você pode resolver questões diretamente pelos tópicos do seu planejamento ou acessar o módulo global de Questões. Ao selecionar os tópicos desejados, escolha entre o Modo Treino (onde a resposta e o comentário detalhado aparecem logo após cada escolha) e o Modo Simulado (com tempo regressivo e relatório completo ao final). Todas as suas estatísticas de erros e acertos ficam salvas no seu histórico.',
    highlights: [
      'Filtre questões por especialidade, tema específico ou banca examinadora.',
      'Acesse comentários explicativos detalhados alternativa por alternativa.',
      'Identifique seus pontos fracos com base nas estatísticas automáticas.'
    ],
    icon: QuestionIcon
  },
  {
    id: 'vincul-1',
    category: 'vinculo',
    question: 'Como funciona a vinculação de matérias entre o MedRevise e o MedInternato?',
    answer: 'A ferramenta "Vínculo & Integração" conecta as disciplinas teóricas do MedRevise aos rodízios práticos do MedInternato. Quando duas matérias estão vinculadas, o progresso em questões, os resumos criados e as revisões pendentes são sincronizados instantaneamente nos dois módulos! Você pode usar a função "Auto-Vincular Mapeamento" no menu de Integração para conectar matérias idênticas com 1 único clique.',
    highlights: [
      'Acesse o item "Vínculo & Integração" no menu lateral para gerenciar suas conexões.',
      'Sincronize matérias teóricas do MedRevise com rodízios do Internato.',
      'Escolha nas configurações do Cronograma se prefere perguntar antes de criar matérias no MedRevise ou sincronizar tudo de forma transparente.'
    ],
    icon: ArrowLeftRight
  },
  {
    id: 'rev-1',
    category: 'revisoes',
    question: 'Como funciona a Curva do Esquecimento e as Revisões Espaçadas?',
    answer: 'Sempre que você conclui um tópico ou responde a uma bateria de questões, o sistema agenda automaticamente ciclos de revisão espaçada (24 horas, 7 dias e 30 dias). O algoritmo adaptativo ajusta a frequência de revisão com base na sua taxa de retenção e facilidade percebida. Além disso, o módulo de Flashcards (Cards) utiliza inteligência para fixação ativa de conceitos e diagnósticos chave.',
    highlights: [
      'Notificações de revisões pendentes no seu painel diário.',
      'Revisões de reforço geradas automaticamente quando o sistema detecta queda de desempenho.',
      'Flashcards dinâmicos com contadores de memorização.'
    ],
    icon: Brain
  },
  {
    id: 'ia-1',
    category: 'ia',
    question: 'Como utilizar o Preceptor IA e Tira-Dúvidas Médico?',
    answer: 'O Preceptor IA é o seu assistente virtual especializado em medicina. Você pode utilizá-lo ao resolver questões para entender a razão de um distrator estar incorreto, solicitar explicações sobre condutas do Ministério da Saúde e diretrizes médicas atuais, ou tirar dúvidas diretamente em qualquer tópico de estudo.',
    highlights: [
      'Suporte a raciocínio clínico e diagnósticos diferenciais.',
      'Explicações passo a passo de condutas, dosagens e diretrizes atualizadas.',
      'Assistência contínua dentro do cronograma e no módulo de questões.'
    ],
    icon: Sparkles
  },
  {
    id: 'quest-2',
    category: 'questoes',
    question: 'Como realizar e analisar Simulados Mensais e Rápidos?',
    answer: 'No módulo de Provas & Simulados, você pode gerar um simulado rápido contendo questões aleatórias ou realizar o simulado mensal completo. Ao concluir a prova, o sistema gera uma análise detalhada das suas notas por grande área (Clínica Médica, Cirurgia, GO, Pediatria e Preventiva) e calcula sua nota estimada de corte.',
    highlights: [
      'Simulados cronometrados idênticos às provas reais de residência.',
      'Relatório detalhado de desempenho por área médica.',
      'Identificação automática das matérias que exigem mais tempo de revisão.'
    ],
    icon: BarChart3
  },
  {
    id: 'geral-1',
    category: 'geral',
    question: 'Meus dados e progresso ficam salvos na nuvem?',
    answer: 'Sim! Todos os seus planejamentos, questões resolvidas, flashcards e configurações são salvos de maneira segura e em tempo real no banco de dados do Firebase. Você pode acessar sua conta de qualquer computador, tablet ou celular e continuar exatamente de onde parou.',
    highlights: [
      'Sincronização instantânea na nuvem.',
      'Acesso seguro e dados vinculados à sua conta de e-mail.',
      'Backup automático continuo.'
    ],
    icon: ShieldCheck
  }
];

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FaqModal({ isOpen, onClose }: FaqModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>('plan-1');

  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        item.question.toLowerCase().includes(query) || 
        item.answer.toLowerCase().includes(query) ||
        (item.highlights && item.highlights.some(h => h.toLowerCase().includes(query)));
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-[#141414]/70 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white border-2 border-[#141414] rounded-3xl w-full max-w-4xl shadow-[10px_10px_0px_0px_rgba(20,20,20,1)] overflow-hidden flex flex-col max-h-[90vh] my-auto"
        >
          {/* Top Header */}
          <div className="p-5 sm:p-6 bg-[#FAF9F5] border-b-2 border-[#141414] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#D44E3D] text-white flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] shrink-0">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#D44E3D] bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                  Central de Ajuda & Guia
                </span>
                <h2 className="font-serif italic text-2xl font-bold text-[#141414] mt-0.5">
                  Como Usar & Dúvidas Frequentes
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 text-stone-500 hover:text-black hover:bg-stone-200/60 rounded-xl transition-all cursor-pointer border border-stone-200"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="p-4 sm:p-5 bg-white border-b border-stone-200 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por dúvida (ex: como criar planejamento, questões, vinculação)..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F5] border-2 border-[#141414]/20 rounded-xl text-xs text-[#141414] focus:outline-none focus:border-[#141414] focus:bg-white transition-all font-medium"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-stone-400 hover:text-stone-700"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Category Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {[
                { id: 'all', label: 'Todas as Dúvidas', icon: BookOpen },
                { id: 'planejamento', label: 'Planejamento', icon: Calendar },
                { id: 'questoes', label: 'Questões & Simulados', icon: QuestionIcon },
                { id: 'vinculo', label: 'Vínculo MedRevise ⇄ MedInternato', icon: ArrowLeftRight },
                { id: 'revisoes', label: 'Curva de Esquecimento', icon: Brain },
                { id: 'ia', label: 'Preceptor IA', icon: Sparkles },
                { id: 'geral', label: 'Geral', icon: ShieldCheck }
              ].map(cat => {
                const IconComponent = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#141414] text-white border-[#141414] shadow-xs'
                        : 'bg-[#FAF9F5] text-stone-600 border-stone-200 hover:border-stone-400 hover:text-black'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accordion List */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-3 bg-[#FAF9F5] flex-1">
            {filteredFaqs.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-stone-300 rounded-2xl bg-white space-y-2">
                <HelpCircle className="w-10 h-10 mx-auto text-stone-300" />
                <h3 className="font-serif italic font-bold text-base text-[#141414]">
                  Nenhuma dúvida encontrada para sua busca.
                </h3>
                <p className="text-xs text-stone-500">
                  Tente pesquisar com outros termos como "planejamento", "questões", "revisão" ou "vinculação".
                </p>
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const IconComp = faq.icon;
                const isExpanded = expandedId === faq.id;

                return (
                  <div
                    key={faq.id}
                    className="bg-white border-2 border-[#141414]/15 hover:border-[#141414] rounded-2xl overflow-hidden transition-all shadow-xs"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                      className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer bg-white hover:bg-stone-50/80 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-stone-200 text-[#D44E3D] shrink-0">
                          <IconComp className="w-4 h-4" />
                        </div>
                        <span className="font-serif italic font-bold text-base text-[#141414] leading-snug">
                          {faq.question}
                        </span>
                      </div>

                      <div className={`p-1.5 rounded-lg bg-stone-100 text-stone-600 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180 bg-[#141414] text-white' : ''}`}>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </button>

                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-5 pb-5 pt-1 border-t border-stone-100 space-y-3 bg-[#FAF9F5]/50"
                      >
                        <p className="text-xs text-stone-700 leading-relaxed font-sans pt-2">
                          {faq.answer}
                        </p>

                        {faq.highlights && faq.highlights.length > 0 && (
                          <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-1.5">
                            <span className="text-[10px] font-mono font-bold uppercase text-stone-500 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-500 fill-amber-400" />
                              Pontos Principais & Dicas
                            </span>
                            <ul className="space-y-1">
                              {faq.highlights.map((h, idx) => (
                                <li key={idx} className="text-[11px] text-stone-600 flex items-start gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>{h}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Footer Action */}
          <div className="p-4 bg-white border-t-2 border-[#141414] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <GraduationCap className="w-4 h-4 text-[#D44E3D]" />
              <span>Ainda com dúvidas? O <strong>Preceptor IA</strong> pode te orientar a qualquer momento!</span>
            </div>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#141414] hover:bg-black text-white font-mono text-xs font-bold uppercase rounded-xl transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(212,78,61,1)]"
            >
              Entendido, fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
