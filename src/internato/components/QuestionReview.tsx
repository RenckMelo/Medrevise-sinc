import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, Bookmark } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { markdownComponents, parseMarkdownAlerts } from '../utils/markdownUtils';


interface QuestionReviewProps {
  attempt: any; // The attempt data from userProgress.attempts
  onBack: () => void;
}

export default function QuestionReview({ attempt, onBack }: QuestionReviewProps) {
  if (!attempt) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E2E0D9] pb-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#8E8A82] font-bold mb-1">Revisão de Questão</div>
          <h1 className="text-3xl lg:text-5xl font-display font-black">Histórico de Prática</h1>
        </div>
        <Button variant="outline" onClick={onBack} className="border-[#E2E0D9] text-[10px] uppercase tracking-widest font-bold h-12 px-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Painel
        </Button>
      </div>

      <div className="max-w-3xl mx-auto">
        <Card className="border-[#E2E0D9] shadow-none rounded-2xl overflow-hidden bg-white mb-8">
          <CardHeader className="p-8 pb-4 bg-[#FBFBFA] border-b border-[#E2E0D9]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] uppercase tracking-widest font-black text-primary bg-primary/10 px-3 py-1 rounded-full">
                {attempt.isCorrect ? 'Acerto' : 'Erro'}
              </span>
              <span className="text-[10px] font-bold text-[#8E8A82]">
                Realizada em {new Date(attempt.timestamp).toLocaleDateString('pt-BR')} às {new Date(attempt.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <CardTitle className="text-xl font-display leading-relaxed">
              {attempt.content || 'Enunciado não disponível'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-4">
            <div className="space-y-3">
              {Object.entries(attempt.options || {}).map(([key, value]: [string, any]) => {
                const isSelected = attempt.selectedOption === key;
                const isCorrect = attempt.correctOption === key;
                
                let bgColor = 'bg-white';
                let borderColor = 'border-[#E2E0D9]';
                let textColor = 'text-[#1A1A1A]';

                if (isSelected && isCorrect) {
                  bgColor = 'bg-green-50';
                  borderColor = 'border-green-500';
                  textColor = 'text-green-700';
                } else if (isSelected && !isCorrect) {
                  bgColor = 'bg-red-50';
                  borderColor = 'border-red-500';
                  textColor = 'text-red-700';
                } else if (!isSelected && isCorrect) {
                  bgColor = 'bg-green-50/50';
                  borderColor = 'border-green-300';
                }

                return (
                  <div 
                    key={key}
                    className={`p-5 rounded-xl border-2 ${bgColor} ${borderColor} ${textColor} flex items-start gap-4 transition-all`}
                  >
                    <div className="mt-0.5">
                      {isSelected && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      {isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500" />}
                      {!isSelected && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-300" />}
                      {!isSelected && !isCorrect && <div className="w-5 h-5 rounded-full border-2 border-[#E2E0D9]" />}
                    </div>
                    <div className="text-sm font-medium leading-relaxed">
                      <span className="font-bold mr-2">{key.toUpperCase()})</span> {value as string}
                    </div>
                  </div>
                );
              })}
            </div>

            {attempt.explanation && (
              <div className="mt-10 p-8 bg-blue-50 border-2 border-blue-100 rounded-2xl">
                <h4 className="text-xs uppercase tracking-widest font-black text-blue-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Comentário da Questão
                </h4>
                <div className="prose prose-blue prose-sm max-w-none text-blue-900 font-medium">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: 'ignore' }]]}
                    components={markdownComponents}
                  >
                    {parseMarkdownAlerts(attempt.explanation || '')}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button 
            variant="ghost" 
            className="text-[#8E8A82] hover:text-primary text-[10px] uppercase font-bold tracking-widest gap-2"
          >
            <Bookmark className="w-4 h-4" /> Salvar nos meus Favoritos
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
