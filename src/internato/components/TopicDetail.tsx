import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Topic, UserProgress, Subject } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ArrowLeft, ArrowRight, BookOpen, Clock, Share2, Sparkles, Loader2, FileText, Brain, Download, ChevronDown, Zap, RefreshCcw, Printer, X, Play, Edit3, Trash2, Maximize2, Bookmark, FolderPlus, Notebook, Copy, Check, PenTool, Eye, EyeOff, Image as ImageIcon, ImageOff, Link as LinkIcon, Upload as UploadIcon, Search, ExternalLink, QrCode, CreditCard, Cpu, Award, ShieldCheck, Columns, Lightbulb, Stethoscope, AlertCircle, HardDriveDownload, WifiOff, MapPin, Plus } from 'lucide-react';
import { SmartPenCanvas } from './SmartPenCanvas';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { generateTopicContent, generateQuestions, generateFlashcards, GenerationDepth, deepenTopicSection, getGlobalUsage, importPdfWithAI, deepenNotebookArea, analyzeSummaryNeeds, generateCustomAnalyzedSummary, generateWithAI, resumeFailedSummaryContent, getChaptersFromMonograph, calculateExtraCredits } from '../services/geminiService';

import { db, doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, limit, deleteDoc } from '../firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { markdownComponents, parseMarkdownAlerts, getEnglishMedicalTerm, expandSearchTerms, isCertifiedMedicalImage, getBestMedicalImageCandidate, scoreMedicalCandidate, convertMarkdownToHtml, syncSummaryTableOfContents } from '../utils/markdownUtils';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../utils/storageUtils';
import { calculateNextReview } from '../../utils/srs';
import SummaryGenerationWizard from './SummaryGenerationWizard';



const isRealContent = (text?: string) => {
  return !!(text && text.trim() && !text.includes('Conteúdo em desenvolvimento'));
};

const getAvailableDepths = (topicDoc: Topic) => {
  const list: { depth: GenerationDepth; label: string }[] = [];
  if (isRealContent(topicDoc.content_standard) || (isRealContent(topicDoc.content) && detectRealDepth(topicDoc) === 'standard')) {
    list.push({ depth: 'standard', label: 'Padrão' });
  }
  if (isRealContent(topicDoc.content_deep)) {
    list.push({ depth: 'deep', label: 'Avançado' });
  }
  if (isRealContent(topicDoc.content_elite)) {
    list.push({ depth: 'elite', label: 'Elite' });
  }
  if (isRealContent(topicDoc.content_master)) {
    list.push({ depth: 'master', label: 'Extensivo' });
  }
  if (isRealContent(topicDoc.content_monograph)) {
    list.push({ depth: 'monograph', label: 'Monografia' });
  }
  if (isRealContent(topicDoc.content_custom_analyzed)) {
    list.push({ depth: 'custom_analyzed', label: 'Personalizado Inteligente' });
  }
  return list;
};

const detectRealDepth = (topic: Topic): GenerationDepth | 'none' => {
  if (topic.importedPdfData) {
    return 'standard';
  }

  // 1. Check if custom analyzed is explicitly stored
  if (isRealContent(topic.content_custom_analyzed)) return 'custom_analyzed';

  // 2. Check if monograph is explicitly stored
  if (isRealContent(topic.content_monograph)) return 'monograph';
  
  // 3. Check if master (Extensivo) is explicitly stored
  if (isRealContent(topic.content_master)) return 'master';
  
  // 4. Check if elite is explicitly stored
  if (isRealContent(topic.content_elite)) return 'elite';
  
  // 5. Check if deep (Avançado) is explicitly stored
  if (isRealContent(topic.content_deep)) return 'deep';
  
  // 6. Inspect standard or legacy fields for content length
  const standardText = topic.content_standard || topic.content || '';
  if (isRealContent(standardText)) {
    const len = standardText.length;
    const numChapters = (standardText.match(/Capítulo \d+/gi) || []).length;
    const hasTratado = standardText.includes('Tratado Médico Especializado') || standardText.includes('MONOGRAFIA') || standardText.includes('Sumário') || standardText.includes('SUMÁRIO');
    
    // Legacy monograph check
    if (len > 11000 || numChapters >= 5 || (len > 8000 && hasTratado)) {
      return 'monograph';
    }
    // Legacy extensivo check
    if (len > 6500) {
      return 'master';
    }
    // Legacy elite check
    if (len > 4000) {
      return 'elite';
    }
    // Legacy deep check
    if (len > 1800) {
      return 'deep';
    }
    return 'standard';
  }
  
  return 'none';
};

const getProxyImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/api/proxy-image')) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

const VERIFIED_CLINICAL_MANUALS_ATLAS = [
  {
    id: 'manual-gyn-01',
    keywords: ['tricomoniase', 'tricomoníase', 'trichomonas', 'colo em morango', 'strawberry cervix', 'cervicite', 'corrimento', 'vagina', 'ginecologia', 'vulvovaginite'],
    title: 'Exame Colposcópico: Cervicite por Trichomonas vaginalis - Aspecto de "Colo em Morango"',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Infectious_CervicitisCDC_PHIL6495.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Infectious_CervicitisCDC_PHIL6495.jpg',
    sourceType: 'book',
    sourceName: 'Manual de Atendimento às ISTs - FEBRASGO / PCDT Ministério da Saúde',
    specialty: 'Ginecologia e Obstetrícia',
    authors: 'Comissão Nacional de Infecções Sexualmente Transmissíveis (FEBRASGO / MS)',
    caption: 'Visualização colposcópica de pontilhado hemorrágico macular no colo uterino ("colo em morango" ou "aspecto em framboesa") acompanhado de corrimento amarelado/bolhoso, achado patognomônico de infecção por Trichomonas vaginalis.',
    score: 300
  },
  {
    id: 'manual-gyn-02',
    keywords: ['candidiase', 'candidíase', 'candida', 'albicans', 'nata de leite', 'queijo coalho', 'corrimento', 'vulvovaginite', 'vagina', 'ginecologia'],
    title: 'Exame Especular: Candidíase Vulvovaginal - Corrimento Grumoso em Nata de Leite',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Speculum_exam_in_candidal_vulvovaginitis.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Speculum_exam_in_candidal_vulvovaginitis.jpg',
    sourceType: 'book',
    sourceName: 'Manual de Ginecologia e Obstetrícia - FEBRASGO / Ministério da Saúde',
    specialty: 'Ginecologia e Obstetrícia',
    authors: 'Comissão de Infecções em GO (FEBRASGO)',
    caption: 'Placas esbranquiçadas grumosas e aderidas à mucosa vaginal e colo uterino (aspecto em "nata de leite" ou "queijo coalho"), acompanhadas de hiperemia e eritema vulvovaginal, típicas de Vulvovaginite por Candida albicans.',
    score: 300
  },
  {
    id: 'manual-gyn-03',
    keywords: ['vaginose', 'gardnerella', 'clue cells', 'celulas guia', 'células guia', 'microscopia', 'corrimento', 'amsel', 'vagina', 'ginecologia'],
    title: 'Microscopia a Fresco: Células-Guia ("Clue Cells") na Vaginose Bacteriana',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/37/Clue_cells_-_CDC_PHIL_3720.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/37/Clue_cells_-_CDC_PHIL_3720.jpg',
    sourceType: 'book',
    sourceName: 'Manual de Diagnóstico Laboratorial das ISTs - Ministério da Saúde & CDC',
    specialty: 'Ginecologia e Infectologia',
    authors: 'Departamento de DST/Aids e Hepatites Virais (Ministério da Saúde)',
    caption: 'Exame a fresco em salina mostrando células epiteliais vaginais com bordas pontilhadas e recobertas por cocobacilos (Gardnerella vaginalis / anaeróbios), apagando seus limites anatômicos ("clue cells"), critério de Amsel para Vaginose Bacteriana.',
    score: 300
  },
  {
    id: 'manual-gyn-04',
    keywords: ['cervicite', 'clamidia', 'clamídia', 'gonococo', 'gonorreia', 'gonorréia', 'mucopurulenta', 'endocervix', 'orificio cervical', 'colo', 'ginecologia', 'corrimento'],
    title: 'Exame Especular: Cervicite Mucopurulenta e Secreção Endocervical Frágil',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Infectious_CervicitisCDC_PHIL6495.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Infectious_CervicitisCDC_PHIL6495.jpg',
    sourceType: 'book',
    sourceName: 'PCDT - Protocolo Clínico e Diretrizes Terapêuticas de ISTs (Ministério da Saúde)',
    specialty: 'Ginecologia e Infectologia',
    authors: 'Secretaria de Vigilância em Saúde / Ministério da Saúde',
    caption: 'Saída de exsudato mucopurulento amarelado pelo orifício externo do colo uterino acompanhada de friabilidade e sangramento ao toque especular, característica da infecção por Chlamydia trachomatis / Neisseria gonorrhoeae.',
    score: 300
  },
  {
    id: 'manual-ist-01',
    keywords: ['sifilis', 'sífilis', 'cancro duro', 'treponema', 'ulsera', 'ulcera', 'úlceras', 'ulceras', 'ist'],
    title: 'Lesão de Sífilis Primária: Cancro Duro Genital',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/88/SOA-Herpes-genitalis-male.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/88/SOA-Herpes-genitalis-male.jpg',
    sourceType: 'book',
    sourceName: 'Guia de Bolso de Infecções Sexualmente Transmissíveis - MS & SBD',
    specialty: 'Infectologia e Dermatologia',
    authors: 'Sociedade Brasileira de Dermatologia / Ministério da Saúde',
    caption: 'Ulceração única, indolor, de bordas endurecidas, fundo limpo e avermelhado (cancro duro), que surge no local de inoculação do Treponema pallidum.',
    score: 300
  },
  {
    id: 'manual-ist-02',
    keywords: ['herpes', 'vesiculas', 'vesículas', 'bolhas', 'herpes genital', 'ulceras dolorosas', 'ist'],
    title: 'Herpes Simples Genital: Vesículas e Agrupamento em Buquê',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/88/SOA-Herpes-genitalis-male.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/88/SOA-Herpes-genitalis-male.jpg',
    sourceType: 'book',
    sourceName: 'Manual de Dermatologia e Infectologia - SBD / Ministério da Saúde',
    specialty: 'Dermatologia e Infectologia',
    authors: 'Sociedade Brasileira de Dermatologia (SBD)',
    caption: 'Lesões vesiculosas eritematomas agrupadas em buquê na mucosa genital que rompem formando pequenas úlceras dolorosas e policíclicas.',
    score: 300
  },
  {
    id: 'manual-ist-03',
    keywords: ['condiloma', 'hpv', 'crista de galo', 'verruga genital', 'papiloma', 'ist'],
    title: 'Condiloma Acuminado Anogenital (Infecção por HPV)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/SOA-Condylomata-acuminata-around-anus.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/SOA-Condylomata-acuminata-around-anus.jpg',
    sourceType: 'book',
    sourceName: 'Manual de Doenças Infecciosas em Ginecologia - FEBRASGO',
    specialty: 'Ginecologia e Dermatologia',
    authors: 'FEBRASGO / SBD',
    caption: 'Pápulas vegetantes, verrucosas e rosadas em formato de "couve-flor" ou "crista de galo" na região anogenital, causadas por HPV tipos 6 e 11.',
    score: 300
  },
  {
    id: 'manual-derma-01',
    keywords: ['psoriase', 'psoríase', 'escamas prateadas', 'auspitz', 'placas eritematoses', 'dermatologia', 'pele'],
    title: 'Psoríase Vulgar em Placas Eritematodescamativas',
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Psoriasis_on_back.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Psoriasis_on_back.jpg',
    sourceType: 'book',
    sourceName: 'Atlas de Dermatologia Clínica - Sociedade Brasileira de Dermatologia (SBD)',
    specialty: 'Dermatologia',
    authors: 'Sociedade Brasileira de Dermatologia (SBD)',
    caption: 'Placas eritematosa bem delimitadas recobertas por escamas prateadas e micáceas na superfície extensora dos membros e dorso.',
    score: 300
  },
  {
    id: 'manual-derma-02',
    keywords: ['erisipela', 'celulite', 'infecção cutânea', 'borda elevada', 'perna', 'dermatologia', 'pele'],
    title: 'Erisipela em Membro Inferior - Eritema com Bordas Nítidas e Elevadas',
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Erysipel.JPG',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Erysipel.JPG',
    sourceType: 'book',
    sourceName: 'Guia de Infectologia Cutânea - SBD / SBI',
    specialty: 'Dermatologia e Infectologia',
    authors: 'Sociedade Brasileira de Infectologia (SBI)',
    caption: 'Placa eritematosa brilhante, quente, dolorosa e edemaciada em perna, com bordas demarcadas e elevadas, típica de infecção por Streptococcus pyogenes.',
    score: 300
  },
  {
    id: 'manual-surg-01',
    keywords: ['apendicite', 'apendice', 'apêndice', 'tomografia', 'tc abdomen', 'apendicolito', 'cirurgia'],
    title: 'Tomografia Computadorizada: Apendicite Aguda com Espessamento de Parede',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/00/Appendicitis_epiploica_CT_axial.png',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/00/Appendicitis_epiploica_CT_axial.png',
    sourceType: 'book',
    sourceName: 'Manual de Urgências Cirúrgicas - Colégio Brasileiro de Cirurgiões (CBC)',
    specialty: 'Cirurgia Geral e Radiologia',
    authors: 'Colégio Brasileiro de Cirurgiões (CBC)',
    caption: 'Corte axial de TC de abdome demonstrando apêndice cecal dilatado (> 6 mm), com espessamento parietal e densificação da gordura periapendicular.',
    score: 300
  },
  {
    id: 'manual-pneu-01',
    keywords: ['pneumonia', 'raio x', 'raio-x', 'radiografia', 'consolidação', 'broncograma aéreo', 'pulmao', 'pulmão'],
    title: 'Radiografia de Tórax: Pneumonia Lobar Típica com Broncogramas Aéreos',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Lobar_Pneumonia_and_bronchopneumonia_illustrated.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Lobar_Pneumonia_and_bronchopneumonia_illustrated.jpg',
    sourceType: 'book',
    sourceName: 'Manual de Pneumologia e Radiologia - SBPT / CBR',
    specialty: 'Pneumologia e Radiologia',
    authors: 'Sociedade Brasileira de Pneumologia e Tisiologia (SBPT)',
    caption: 'Opacidade alveolar homogênea em lobo pulmonar com presença de broncogramas aéreos visíveis no seu interior, característica de pneumonia bacteriana (Streptococcus pneumoniae).',
    score: 300
  },
  {
    id: 'manual-cardio-01',
    keywords: ['infarto', 'iam', 'ecg', 'electrocardiograma', 'eletrocardiograma', 'supradesnivelamento', 'cardiologia', 'st'],
    title: 'Eletrocardiograma (ECG): Infarto Agudo do Miocárdio com Supra de ST (IAMST)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Myocardial_infarction_ECG.svg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Myocardial_infarction_ECG.svg',
    sourceType: 'book',
    sourceName: 'Diretrizes de Cardiologia e Emergências Cardiovascular - SBC / AHA',
    specialty: 'Cardiologia',
    authors: 'Sociedade Brasileira de Cardiologia (SBC)',
    caption: 'Traçado eletrocardiográfico demonstrando supradesnivelamento do segmento ST em derivações anterolaterais com imagem no espelho em derivações inferiores, indicativo de oclusão coronariana aguda.',
    score: 300
  },
  {
    id: 'manual-gastro-01',
    keywords: ['cirrose', 'ascite', 'figado', 'fígado', 'hipertensao portal', 'gastroenterologia', 'hepatologia'],
    title: 'Exame Físico e Ultrassonográfico: Cirrose Hepática e Ascite de Grande Volume',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Hepaticfailure.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Hepaticfailure.jpg',
    sourceType: 'book',
    sourceName: 'Manual de Gastroenterologia e Hepatologia - FBG / SBH',
    specialty: 'Gastroenterologia',
    authors: 'Federação Brasileira de Gastroenterologia (FBG)',
    caption: 'Distorção anatômica do fígado nodular com presença de líquido livre na cavidade peritoneal (ascite) e circulação colateral abdominal em cabeça de medusa.',
    score: 300
  },
  {
    id: 'manual-neuro-01',
    keywords: ['avc', 'isquemico', 'tomografia', 'tc cranio', 'isquemia', 'neurologia'],
    title: 'Tomografia Computadorizada de Crânio: AVC Isquêmico em Território de ACM',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Brain_CT_Scan_for_Stroke_Diagnosis.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Brain_CT_Scan_for_Stroke_Diagnosis.jpg',
    sourceType: 'book',
    sourceName: 'Manual de Neurologia Clínica - Academia Brasileira de Neurologia (ABN)',
    specialty: 'Neurologia',
    authors: 'Academia Brasileira de Neurologia (ABN)',
    caption: 'TC de crânio sem contraste evidenciando área hipodensa no território de irrigação da artéria cerebral média esquerda com apagamento de sulcos corticais e perda da diferenciação cortico-subcortical.',
    score: 300
  },
  {
    id: 'manual-reumato-01',
    keywords: ['lupus', 'lúpus', 'eritema malar', 'asa de borboleta', 'reumatologia'],
    title: 'Exame Físico: Lúpus Eritematoso Sistêmico - Lesão Malar em "Asa de Borboleta"',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/68/Dermatomyositis13.jpg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/68/Dermatomyositis13.jpg',
    sourceType: 'book',
    sourceName: 'Diretrizes de Reumatologia - Sociedade Brasileira de Reumatologia (SBR)',
    specialty: 'Reumatologia',
    authors: 'Sociedade Brasileira de Reumatologia (SBR)',
    caption: 'Eritema fixo maculopapular sobre o dorso do nariz e eminências malares respeitando os sulcos nasolabiais, achado clássico de fotossensibilidade no LES.',
    score: 300
  }
];

const sanitizeTitle = (title: string) => {
  if (!title) return '';
  return title.replace(/<\/?[^>]+(>|$)/g, "").trim();
};

const SummaryDossierHeader = ({
  title,
  subjectName,
  depth,
  lastUpdated,
  wordCount,
  readingTime,
  hideTitle = false
}: {
  title: string;
  subjectName?: string;
  depth: GenerationDepth;
  lastUpdated?: string;
  wordCount: number;
  readingTime: number;
  hideTitle?: boolean;
}) => {
  const depthLabels: Record<string, { label: string; color: string; badgeBg: string }> = {
    standard: { label: 'Resumo Padrão', color: 'text-amber-800', badgeBg: 'bg-amber-50 border-amber-200/80' },
    deep: { label: 'Resumo Avançado', color: 'text-blue-800', badgeBg: 'bg-blue-50 border-blue-200/80' },
    elite: { label: 'Resumo Elite', color: 'text-red-800', badgeBg: 'bg-red-50 border-red-200/80' },
    master: { label: 'Tratado Extensivo', color: 'text-purple-800', badgeBg: 'bg-purple-50 border-purple-200/80' },
    monograph: { label: 'Monografia / TCC', color: 'text-emerald-800', badgeBg: 'bg-emerald-50 border-emerald-200/80' },
    custom_analyzed: { label: 'Análise Inteligente', color: 'text-rose-800', badgeBg: 'bg-rose-50 border-rose-200/80' }
  };

  const depthInfo = depthLabels[depth] || depthLabels.standard;

  return (
    <div className="mb-8 pb-6 border-b border-[#E2E0D9] relative select-none">
      {/* Top Gradient Decorative Bar */}
      <div className="h-2 -mx-6 -mt-6 sm:-mx-10 sm:-mt-10 md:-mx-14 md:-mt-14 mb-8 bg-gradient-to-r from-[#D44E3D] via-[#E06A58] to-amber-500 rounded-t-2xl opacity-90" />

      {/* Top Meta Badges & Level */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-[#F4F3EF] text-[#1A1A1A] text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-full border border-[#E2E0D9]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D44E3D]" />
            Internato Med • Diretriz de Elite
          </span>
          {subjectName && (
            <span className="bg-[#D44E3D]/10 text-[#D44E3D] text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 rounded-full border border-[#D44E3D]/20">
              {subjectName}
            </span>
          )}
          <span className={cn("text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 rounded-full border", depthInfo.badgeBg, depthInfo.color)}>
            {depthInfo.label}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10.5px] text-[#8E8A82] font-semibold">
          <span className="inline-flex items-center gap-1 bg-[#F8F7F4] px-2.5 py-1 rounded-md border border-[#E2E0D9]">
            <Clock className="w-3 h-3 text-[#8E8A82]" />
            ~{readingTime} min ({wordCount} palavras)
          </span>
          {lastUpdated && (
            <span className="hidden sm:inline-flex items-center gap-1 bg-[#F8F7F4] px-2.5 py-1 rounded-md border border-[#E2E0D9]">
              <Sparkles className="w-3 h-3 text-amber-500" />
              {new Date(lastUpdated).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {/* Main Title if not in content */}
      {!hideTitle && (
        <h1 className="text-3xl sm:text-4xl font-black text-[#1A1A1A] tracking-tight font-display mb-3 leading-snug">
          {sanitizeTitle(title)}
        </h1>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8E8A82] font-medium pt-1">
        <span className="flex items-center gap-1.5 text-[11px] text-[#6E6A62]">
          <Award className="w-3.5 h-3.5 text-[#D44E3D]" />
          Conteúdo Médico Estruturado de Alta Fidelidade (GO/DF)
        </span>
        <span className="text-[10px] font-mono uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold">
          ✓ Validação Clínica
        </span>
      </div>
    </div>
  );
};

const normalizePipeTables = (content: string): string => {
  if (!content.includes('|')) return content;
  const lines = content.split('\n');
  const result: string[] = [];
  let tableBlock: string[] = [];
  let inCodeBlock = false;

  const isFlowchartOrDrawing = (line: string) => {
    const t = line.trim();
    return t.includes('▼') || t.includes('▲') || t.includes('→') || t.includes('➔') || t.includes('⇒') || t.includes('↓') || t.includes('(Falha)') || t.includes('(Sucesso)') || /[┴┬┌┐└┘░█■┼├┤]/.test(t);
  };

  const isSeparatorRow = (line: string) => {
    const trimmed = line.trim();
    return /^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)+\|?$/.test(trimmed);
  };

  const isPipeRow = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('```') || trimmed.startsWith('#')) return false;
    if (isFlowchartOrDrawing(line)) return false;
    const cols = trimmed.split('|').map(c => c.trim()).filter(Boolean);
    return cols.length >= 2 || isSeparatorRow(trimmed);
  };

  const flushTable = () => {
    if (tableBlock.length === 0) return;
    
    // Check if any row in tableBlock has flowchart elements
    if (tableBlock.some(isFlowchartOrDrawing)) {
      result.push(...tableBlock);
      tableBlock = [];
      return;
    }

    const hasSep = tableBlock.some(isSeparatorRow);
    const normalizedRows = tableBlock.map(l => {
      const trimmed = l.trim();
      if (isSeparatorRow(trimmed)) return trimmed;
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      return `| ${cells.join(' | ')} |`;
    });

    if (!hasSep && normalizedRows.length > 0) {
      const firstRowCells = tableBlock[0].split('|').map(c => c.trim()).filter(Boolean);
      const colCount = Math.max(1, firstRowCells.length);
      const sepRow = `| ${Array(colCount).fill('---').join(' | ')} |`;
      result.push(normalizedRows[0]);
      result.push(sepRow);
      for (let i = 1; i < normalizedRows.length; i++) {
        result.push(normalizedRows[i]);
      }
    } else {
      result.push(...normalizedRows);
    }
    tableBlock = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      flushTable();
      result.push(line);
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    if (isPipeRow(line)) {
      tableBlock.push(line);
    } else {
      flushTable();
      result.push(line);
    }
  }
  flushTable();

  return result.join('\n');
};

const sanitizeMarkdown = (content: string) => {
  if (!content) return '';
  
  let processed = normalizePipeTables(content);

  // Unescape AI-escaped markdown links e.g. \[text\](#anchor) or \[text\]\(#anchor\)
  processed = processed
    .replace(/\\\[([^\]\n]+)\\\]\\?\(([^)\n]+)\\?\)/g, '[$1]($2)')
    .replace(/\[([^\]\n]+)\]\\\(([^)\n]+)\\\)/g, '[$1]($2)')
    .replace(/\\\[([^\]\n]+)\\\]/g, '[$1]');

  // Clean up double-encoded or stray HTML entities so they aren't rendered as raw text like "&gt;"
  processed = processed
    .replace(/&amp;gt;/g, '>')
    .replace(/&amp;lt;/g, '<')
    .replace(/&amp;amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<');

  // Fix broken Markdown links missing brackets before anchor parentheses, e.g. "Text(#anchor)" or "1. Text(#anchor)"
  processed = processed.replace(/^(\s*(?:\d+\.|\*|-)?\s*)([^[\r\n#()]+?)\s*\((#[a-zA-Z0-9_-]+)\)/gm, '$1[$2]($3)');

  // Clean up GFM blockquote alerts first
  processed = parseMarkdownAlerts(processed);
  
  // Convert raw ASCII horizontal arrow diagrams into clean formatted bullet lists & arrows
  if (/[─►]/.test(processed)) {
    processed = processed
      .replace(/──+►/g, ' → ')
      .replace(/──+/g, ' ');
  }
  
  // 1. First, let's unwrap any SVGs that are inside ```xml or ```html or ```svg code blocks
  // to make sure they render as actual live SVGs using rehypeRaw instead of codeblocks
  processed = processed.replace(/```(?:xml|html|svg)?\s*(<svg[\s\S]*?<\/svg>)\s*```/gi, '$1');

  // 2. Sanitize any raw '<' and '>' inside SVG <text> tags, translating them to safe HTML entities
  // so that the HTML and XML parser doesn't break on signs like < 1,0 or < p5
  processed = processed.replace(/<svg([\s\S]*?)>([\s\S]*?)<\/svg>/gi, (match, attrs, svgContent) => {
    let sanitizedContent = svgContent.replace(/<text([^>]*)>([\s\S]*?)<\/text>/gi, (textMatch, textAttrs, textContent) => {
      let cleanText = textContent;
      // Replace raw '<' with '&lt;' except for tspan tags
      cleanText = cleanText.replace(/<(?!tspan|\/tspan)/gi, '&lt;');
      // Replace raw '>' with '&gt;' except for tspan tags
      cleanText = cleanText.replace(/(?<!tspan|\/tspan)>/gi, '&gt;');
      return `<text${textAttrs}>${cleanText}</text>`;
    });
    // Remove newlines inside SVG to prevent markdown paragraph engines from splitting structural child elements
    sanitizedContent = sanitizedContent.replace(/\s*[\r\n]+\s*/g, ' ');
    return `<svg${attrs}>${sanitizedContent}</svg>`;
  });

  // 3. LaTeX wrapping and beautiful flow diagrams translation
  // First, translate standalone text badges wrapped in double dollars ($$\text{...}$$) or single dollars ($\text{...}$)
  // so that they are turned into beautiful standard HTML badges (removing the outer dollar signs entirely)
  processed = processed.replace(/\$\$\s*\\text\{([^}]+)\}\s*\$\$/g, (_, val) => `<span class="font-sans font-bold text-gray-900 border-b-2 border-primary/20 pb-0.5 px-2 bg-[#FBFBFA] rounded-md inline-block shadow-sm text-xs leading-relaxed my-0.5 align-middle select-all-custom">${val}</span>`);
  processed = processed.replace(/(?<!\$)\$\s*\\text\{([^}]+)\}\s*\$(?!\$)/g, (_, val) => `<span class="font-sans font-bold text-gray-900 border-b-2 border-primary/20 pb-0.5 px-2 bg-[#FBFBFA] rounded-md inline-block shadow-sm text-xs leading-relaxed my-0.5 align-middle select-all-custom">${val}</span>`);

  // Mask remaining math blocks (e.g., actual formulas) so we do not run plain-text regexes inside valid LaTeX
  const mathBlocks: string[] = [];
  processed = processed.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    mathBlocks.push(match);
    return `===MATHBLOCKPLACEHOLDER${mathBlocks.length - 1}===`;
  });
  processed = processed.replace(/\$[^$]*?\$/g, (match) => {
    mathBlocks.push(match);
    return `===MATHBLOCKPLACEHOLDER${mathBlocks.length - 1}===`;
  });

  // Now perform plain-text replacements safely without affecting actual math blocks
  processed = processed.replace(/\\xrightarrow\{\\oplus\}/g, '<span class="inline-flex items-center mx-1.5 gap-1 my-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-bold border border-green-200 text-[10px]" title="Feedback Positivo (Estímulo)">➔ (+)</span>');
  processed = processed.replace(/\\xrightarrow\{\\ominus\}/g, '<span class="inline-flex items-center mx-1.5 gap-1 my-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[10px]" title="Feedback Negativo (Inibição)">➔ (-)</span>');
  processed = processed.replace(/\\xrightarrow\{([^}]+)\}/g, (_, inner) => {
    const isPlus = inner.includes('plus') || inner.includes('oplus') || inner === '+' || inner === '\\oplus';
    const isMinus = inner.includes('minus') || inner.includes('ominus') || inner === '-' || inner === '\\ominus';
    if (isPlus) return '<span class="inline-flex items-center mx-1.5 gap-1 my-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-bold border border-green-200 text-[10px]" title="Feedback Positivo">➔ (+)</span>';
    if (isMinus) return '<span class="inline-flex items-center mx-1.5 gap-1 my-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[10px]" title="Feedback Negativo">➔ (-)</span>';
    return `<span class="inline-flex items-center mx-1.5 gap-1 my-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200 text-[10px]">➔ ${inner}</span>`;
  });
  processed = processed.replace(/\\rightarrow|\\to/g, '<span class="text-[#8E8A82] font-black mx-1.5 font-sans">➔</span>');
  processed = processed.replace(/\\oplus/g, '<span class="text-green-600 font-bold">(+)</span>');
  processed = processed.replace(/\\ominus/g, '<span class="text-rose-600 font-bold">(-)</span>');

  processed = processed.replace(/(?<!\$)\\(le|ge|leq|geq|alpha|beta|gamma|delta|omega|mu|sigma|pi|tau|epsilon|theta|phi|rho|lambda)(?!\$)/g, ' $$$&$$ ');

  // Restore the original saved math blocks perfectly unchanged
  mathBlocks.forEach((block, idx) => {
    processed = processed.replaceAll(`===MATHBLOCKPLACEHOLDER${idx}===`, () => block);
  });

  // 4. Clean up <title> tags and any unwanted non-allowed HTML tags, preserving safe tags (including SVG components)
  processed = processed.replace(/<title>.*?<\/title>/gi, '')
                .replace(/<(\/?[a-zA-Z0-9:][^>]*?)>/g, (match, tagContent) => {
                  const allowed = [
                    'br', 'b', 'i', 'strong', 'em', 'p', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'u', 
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
                    'svg', 'rect', 'circle', 'line', 'path', 'g', 'text', 'polygon', 'polyline', 'defs', 'marker',
                    'div', 'span', 'img', 'a', 'style'
                  ];
                  const tag = tagContent.replace('/', '').toLowerCase().split(' ')[0];
                  return allowed.includes(tag) ? match : '';
                });

  return processed;
};

function hslToRgb(h: number, s: number, l: number, a: number = 1): string {
  const sFraction = s / 100;
  const lFraction = l / 100;
  
  const c = (1 - Math.abs(2 * lFraction - 1)) * sFraction;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lFraction - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h <= 360) {
    r = c; g = 0; b = x;
  }
  
  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);
  
  if (a === 1) {
    return `rgb(${red}, ${green}, ${blue})`;
  } else {
    return `rgba(${red}, ${green}, ${blue}, ${a})`;
  }
}

function convertOklchToRgb(oklchStr: string): string {
  try {
    let str = oklchStr.trim().toLowerCase();
    if (!str.startsWith('oklch(')) return oklchStr;
    
    str = str.substring(6, str.length - 1); // remove oklch( and )
    
    const parts = str.split(/[\s,\/]+/);
    if (parts.length < 3) return oklchStr;
    
    let lValue = parts[0];
    let cValue = parts[1];
    let hValue = parts[2];
    let aValue = parts[3] || '1';
    
    let l = parseFloat(lValue);
    if (lValue.endsWith('%')) {
      l = parseFloat(lValue) / 100;
    }
    if (isNaN(l)) l = 0.95; // light background fallback
    
    let c = parseFloat(cValue);
    if (cValue.endsWith('%')) {
      c = parseFloat(cValue) / 100;
    }
    if (isNaN(c)) c = 0;
    
    let h = parseFloat(hValue);
    if (hValue.endsWith('deg')) {
      h = parseFloat(hValue);
    } else if (hValue.endsWith('rad')) {
      h = parseFloat(hValue) * (180 / Math.PI);
    } else if (hValue.endsWith('grad')) {
      h = parseFloat(hValue) * 0.9;
    } else if (hValue.endsWith('turn')) {
      h = parseFloat(hValue) * 360;
    }
    if (isNaN(h)) h = 0;
    
    let a = parseFloat(aValue);
    if (aValue.endsWith('%')) {
      a = parseFloat(aValue) / 100;
    }
    if (isNaN(a)) a = 1;
    
    const lHsl = Math.round(l * 100);
    const sHsl = Math.min(100, Math.round(c * 270));
    const hHsl = Math.round(h);
    
    return hslToRgb(hHsl, sHsl, lHsl, a);
  } catch (err) {
    console.error('Error parsing oklch color:', oklchStr, err);
    return '#ffffff';
  }
}

function SidebarIllustrationCard({ ill, onRemove, onSearchReplacement }: { ill: any; onRemove: () => void; onSearchReplacement?: (id: string, phrase: string) => void }) {
  const [hasError, setHasError] = React.useState(ill.url?.startsWith('placeholder://'));
  const [isLoading, setIsLoading] = React.useState(!ill.url?.startsWith('placeholder://'));

  const searchGoogleImages = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(ill.phrase + " medicine pathology")}`;

  if (hasError) {
    return (
      <div className="border border-[#E2E0D9] rounded-xl p-4 bg-white shadow-sm relative space-y-3">
        <div className="absolute top-2 right-2">
          <button
            onClick={onRemove}
            className="p-1 rounded-full bg-stone-100 hover:bg-red-50 text-stone-500 hover:text-red-600 transition-colors cursor-pointer"
            title="Fechar e remover"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-stone-500">
          <BookOpen className="w-4 h-4" />
          <span className="text-[10px] font-bold font-mono uppercase tracking-wider">
            Referência de Livro
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-stone-800 text-xs font-semibold leading-tight">
            "{ill.phrase}"
          </p>
          <p className="text-[10px] text-stone-500 leading-relaxed">
            Tentamos carregar uma imagem de livro correspondente, mas ela está indisponível. Use as vias abaixo para referência direta ou pesquise em livros e artigos:
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
          <a
            href={searchGoogleImages}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200/50 cursor-pointer"
          >
            <Search className="w-2.5 h-2.5" />
            Fotos Reais
          </a>
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(ill.phrase)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200/50 cursor-pointer"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            PubMed
          </a>
          {onSearchReplacement && (
            <button
              onClick={() => onSearchReplacement(ill.id, ill.phrase)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-white bg-[#D44E3D] hover:bg-[#b53f31] rounded-lg border border-[#D44E3D]/50 cursor-pointer"
            >
              <Search className="w-2.5 h-2.5" />
              Buscar Ilustração
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[#E2E0D9] rounded-xl overflow-hidden bg-white shadow-sm relative group/ill">
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={onRemove}
          className="p-1 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors cursor-pointer"
          title="Fechar e remover"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {onSearchReplacement && (
        <div className="absolute top-2 left-2 z-10 opacity-0 group-hover/ill:opacity-100 transition-opacity">
          <button
            onClick={() => onSearchReplacement(ill.id, ill.phrase)}
            className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white bg-[#D44E3D] hover:bg-[#b53f31] rounded-lg shadow-md border border-[#D44E3D]/50 cursor-pointer"
            title="Substituir por imagem de Livro ou Artigo Científico"
          >
            <Search className="w-2.5 h-2.5" />
            Mudar Imagem
          </button>
        </div>
      )}

      <div className="aspect-[4/3] bg-stone-100 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-50">
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
          </div>
        )}
        <img
          src={ill.url}
          alt={ill.phrase}
          onLoad={() => setIsLoading(false)}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover group-hover/ill:scale-105 transition-transform duration-300 cursor-pointer"
          referrerPolicy="no-referrer"
          onClick={() => {
            window.open(ill.url, '_blank');
          }}
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
          <span className="text-[9px] bg-[#D44E3D] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mb-1 inline-block">
            {ill.sourceType === 'book' ? 'Livro de Medicina 📚' : ill.sourceType === 'generated' ? 'Preceptor IA' : ill.sourceType === 'uploaded' ? 'Foto Própria' : 'Link Web'}
          </span>
          {ill.bookInfo && (
            <span className="text-[9px] text-amber-200 block font-bold leading-tight mb-1 max-w-[95%] truncate" title={ill.bookInfo.title}>
              {ill.bookInfo.title}
            </span>
          )}
          <p className="text-white text-xs font-bold leading-tight font-sans italic">
            "{ill.phrase}"
          </p>
          <span className="text-[9px] text-stone-300 block mt-1">
            Adicionado em {new Date(ill.createdAt).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>
    </div>
  );
}

interface TopicDetailProps {
  topic: Topic;
  userProgress: UserProgress | null;
  onBack: () => void;
  onComplete: () => void;
  subjects: Subject[];
  userId: string;
  userEmail?: string;
  onTopicUpdate?: (updatedTopic: Topic) => void;
  onStartPractice?: () => void;
  onStartFlashcards?: () => void;
  onProgressUpdate?: (updates: Partial<UserProgress>) => void;
  onToggleAppMode?: () => void;
  availableCredits?: number;
  setAvailableCredits?: (credits: number) => void;
}

export default function TopicDetail({ topic: initialTopic, userProgress, onBack, onComplete, subjects, userId, userEmail = '', onTopicUpdate, onStartPractice, onStartFlashcards, onProgressUpdate, onToggleAppMode, availableCredits, setAvailableCredits }: TopicDetailProps) {
  const [localTopic, setLocalTopic] = useState<Topic>(initialTopic);
  const topic = localTopic;
  
  const getTopicDocRef = (id: string = topic.id) => {
    if (userId) {
      return doc(db, 'users', userId, 'topics', id);
    }
    return doc(db, 'topics', id);
  };
  const isCompleted = Boolean(userProgress?.completedTopicIds?.includes?.(topic.id));
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerationError, setLastGenerationError] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [referencePref, setReferencePref] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('');

  // Offline Cache state
  const [isCachedOffline, setIsCachedOffline] = useState<boolean>(false);
  const [offlineToastMessage, setOfflineToastMessage] = useState<string | null>(null);
  const [showSummaryWizard, setShowSummaryWizard] = useState<boolean>(() => {
    // Only open the wizard initially if no real summary has been created yet (getAvailableDepths is empty)
    const hasAnySummary = getAvailableDepths(initialTopic).length > 0;
    return !hasAnySummary;
  });

  const [depth, setDepth] = useState<GenerationDepth>(() => {
    const d = detectRealDepth(initialTopic);
    return d !== 'none' ? d : 'standard';
  });
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isDeepening, setIsDeepening] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const fullscreenScrollRef = useRef<HTMLDivElement>(null);

  const [customDeepenText, setCustomDeepenText] = useState('');
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [monographProgress, setMonographProgress] = useState<{current: number, total: number, message: string} | null>(null);
  const [globalQuota, setGlobalQuota] = useState<{available: number, limit: number} | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<any>(() => {
    if (initialTopic.custom_analysis) return initialTopic.custom_analysis;
    const stored = safeLocalStorageGet('auto_gen_custom_analysis');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.topicId === initialTopic.id) {
          return parsed.analysis;
        }
      } catch (e) {}
    }
    return null;
  });
  const [editedChapters, setEditedChapters] = useState<string[]>([]);
  const [newChapterName, setNewChapterName] = useState('');

  // Subscription and credit limits modal states
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<'med_revise_pro' | 'med_internato_premium' | 'combo_ouro'>('med_internato_premium');
  const [paymentMethodTab, setPaymentMethodTab] = useState<'pix' | 'cartao'>('pix');
  
  // Real Mercado Pago states
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 mins (900s)

  // Real Pix generation state
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrBase64, setPixQrBase64] = useState('');
  const [pixPaymentId, setPixPaymentId] = useState('');
  const [pixGenerated, setPixGenerated] = useState(false);
  const [generatingPix, setGeneratingPix] = useState(false);

  // Form info
  const [cpf, setCpf] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [isApplyingTopicReferral, setIsApplyingTopicReferral] = useState(false);
  const [topicReferralMsg, setTopicReferralMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApplyTopicReferralCode = async () => {
    if (!referralCodeInput.trim() || !userId) return;
    setIsApplyingTopicReferral(true);
    setTopicReferralMsg(null);
    try {
      const cleanKey = referralCodeInput.trim().toUpperCase();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('referralKey', '==', cleanKey));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setTopicReferralMsg({ type: 'error', text: 'Código de indicação inválido ou não encontrado.' });
        setIsApplyingTopicReferral(false);
        return;
      }
      
      const friendDoc = querySnapshot.docs[0];
      const friendUid = friendDoc.id;
      if (friendUid === userId) {
        setTopicReferralMsg({ type: 'error', text: 'Você não pode utilizar seu próprio código.' });
        setIsApplyingTopicReferral(false);
        return;
      }

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        usedReferralKey: cleanKey,
        referralOwnerUid: friendUid,
        referralRewardGranted: false
      });

      setTopicReferralMsg({ type: 'success', text: `Código ${cleanKey} vinculado com sucesso! O dono do código receberá +5 dias adicionais ao plano atual assim que o seu pagamento for confirmado.` });
    } catch (err) {
      console.error('Error applying referral code in TopicDetail:', err);
      setTopicReferralMsg({ type: 'error', text: 'Erro ao aplicar o código. Tente novamente.' });
    } finally {
      setIsApplyingTopicReferral(false);
    }
  };

  // Live status checker states
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [checkingStatusMessage, setCheckingStatusMessage] = useState('');

  // Countdown timer logic for real Pix
  useEffect(() => {
    if (!pixGenerated) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setPixGenerated(false);
          setPixQrCode('');
          setPixQrBase64('');
          return 900;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pixGenerated]);

  useEffect(() => {
    const savedAnalysis = (localTopic as any)[`analysis_${depth}`];
    if (savedAnalysis) {
      setAnalysisResult(savedAnalysis);
      setEditedChapters(savedAnalysis.chapters || []);
    } else if (depth === 'custom_analyzed' && localTopic.custom_analysis) {
      setAnalysisResult(localTopic.custom_analysis);
      setEditedChapters(localTopic.custom_analysis.chapters || []);
    } else {
      setAnalysisResult(null);
      setEditedChapters([]);
    }
  }, [localTopic.id, depth]);

  // Force scroll to top when topic document, ID, content, or depth changes
  useEffect(() => {
    const performScrollReset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
      const scrollContainers = document.querySelectorAll('main, .overflow-y-auto');
      scrollContainers.forEach(container => {
        container.scrollTop = 0;
      });
      document.body.scrollTop = 0;
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
    };

    // Perform immediately
    performScrollReset();

    // Also schedule a microtask / short timeout to run after React finishes rendering the fresh DOM
    const timer = setTimeout(performScrollReset, 100);
    return () => clearTimeout(timer);
  }, [localTopic?.id, localTopic?.content_standard, localTopic?.content, depth]);

  const highlightPenRef = useRef<HTMLDivElement>(null);

  // Highlighting & clipping state, notebook
  const [highlights, setHighlights] = useState<{ id: string; text: string; color: string; note?: string; occurrence?: number }[]>(() => {
    const userAnns = (userProgress as any)?.topicAnnotations?.[`${initialTopic.id}_${depth}`];
    if (userAnns) return userAnns.highlights || [];
    // Fallback to legacy
    const legacyAnns = (userProgress as any)?.topicAnnotations?.[initialTopic.id];
    return legacyAnns?.highlights || initialTopic.highlights || [];
  });
  const [clippings, setClippings] = useState<{ id: string; text: string; category: string; createdAt: string; occurrence?: number }[]>(() => {
    const userAnns = (userProgress as any)?.topicAnnotations?.[`${initialTopic.id}_${depth}`];
    if (userAnns) return userAnns.clippings || [];
    // Fallback to legacy
    const legacyAnns = (userProgress as any)?.topicAnnotations?.[initialTopic.id];
    return legacyAnns?.clippings || initialTopic.clippings || [];
  });
  const [illustrations, setIllustrations] = useState<{ id: string; phrase: string; url: string; sourceType: 'generated' | 'uploaded' | 'link' | 'book'; bookInfo?: { title: string; authors?: string }; createdAt: string }[]>(() => {
    const userAnns = (userProgress as any)?.topicAnnotations?.[`${initialTopic.id}_${depth}`];
    if (userAnns) return userAnns.illustrations || [];
    const legacyAnns = (userProgress as any)?.topicAnnotations?.[initialTopic.id];
    return legacyAnns?.illustrations || initialTopic.illustrations || [];
  });
  const [illustrationLevel, setIllustrationLevel] = useState<'minimum' | 'moderate' | 'maximum'>(() => {
    return (localStorage.getItem('pref_illustration_level') as any) || 'moderate';
  });
  const [alertBoxLevel, setAlertBoxLevel] = useState<'minimum' | 'moderate' | 'maximum' | 'off' | 'light' | 'academic' | 'extreme' | string>(() => {
    return (localStorage.getItem('pref_alert_box_level') as any) || 'moderate';
  });
  const [isRequestingIllustration, setIsRequestingIllustration] = useState(false);
  const [showIllustrationSearchModal, setShowIllustrationSearchModal] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState('');
  const [searchModalSourceBooks, setSearchModalSourceBooks] = useState(true);
  const [searchModalSourceArticles, setSearchModalSourceArticles] = useState(true);
  const [searchModalResults, setSearchModalResults] = useState<any[]>([]);
  const [searchModalLoading, setSearchModalLoading] = useState(false);
  const [searchModalAiLoading, setSearchModalAiLoading] = useState(false);

  const [searchModalReplacingId, setSearchModalReplacingId] = useState<string | null>(null);
  const [searchModalSelectedId, setSearchModalSelectedId] = useState<string | null>(null);
  const [selectedInsertionSectionId, setSelectedInsertionSectionId] = useState<string>('auto');
  const [modalStep, setModalStep] = useState<'select_image' | 'select_location'>('select_image');

  // Prevent background body scroll when the image modal is open
  useEffect(() => {
    if (showIllustrationSearchModal) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [showIllustrationSearchModal]);

  // Helper to extract sections/subtitles from markdown content and determine default section for image insertion
  const getTopicSectionsAndDefault = (content: string, selectedTerm: string) => {
    if (!content || !content.trim()) {
      return { sections: [], defaultSectionId: 'end', defaultHeadingText: 'Final do Texto' };
    }

    const headingRegex = /^(#{1,4})\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    const rawSections: { level: number; text: string; index: number }[] = [];

    while ((match = headingRegex.exec(content)) !== null) {
      const rawText = match[2].trim().replace(/[*_~`#]/g, '');
      if (rawText) {
        rawSections.push({
          level: match[1].length,
          text: rawText,
          index: match.index
        });
      }
    }

    if (rawSections.length === 0) {
      return { sections: [], defaultSectionId: 'end', defaultHeadingText: 'Final do Texto' };
    }

    const sections: { id: string; headingText: string; level: number; startIndex: number; endIndex: number }[] = [];
    for (let i = 0; i < rawSections.length; i++) {
      const curr = rawSections[i];
      const nextSameOrHigher = rawSections.slice(i + 1).find(m => m.level <= curr.level);
      const endIndex = nextSameOrHigher ? nextSameOrHigher.index : content.length;

      sections.push({
        id: `sec-${i}`,
        headingText: curr.text,
        level: curr.level,
        startIndex: curr.index,
        endIndex
      });
    }

    let defaultSectionId = sections[0].id;
    let defaultHeadingText = sections[0].headingText;

    if (selectedTerm && selectedTerm.trim().length > 0) {
      const cleanTerm = selectedTerm.trim().toLowerCase();
      let termIndex = content.toLowerCase().indexOf(cleanTerm);
      if (termIndex === -1) {
        const words = cleanTerm.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
          termIndex = content.toLowerCase().indexOf(words[0]);
        }
      }

      if (termIndex !== -1) {
        const containing = [...sections].reverse().find(s => s.startIndex <= termIndex);
        if (containing) {
          defaultSectionId = containing.id;
          defaultHeadingText = containing.headingText;
        }
      }
    }

    return { sections, defaultSectionId, defaultHeadingText };
  };
  const [notebookTab, setNotebookTab] = useState<'notes' | 'images'>('notes');
  const [showNotebook, setShowNotebook] = useState(true);
  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false);

  // States & Ref for Visual Summary Editor
  const [editViewMode, setEditViewMode] = useState<'split' | 'visual' | 'code'>('split');
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);

  const insertSnippet = (prefix: string, suffix: string = '', defaultText: string = '') => {
    if (!editorTextareaRef.current) {
      setEditedContent(prev => prev + '\n\n' + prefix + defaultText + suffix);
      return;
    }
    const el = editorTextareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selection = editedContent.substring(start, end) || defaultText;
    const replacement = prefix + selection + suffix;
    const newContent = editedContent.substring(0, start) + replacement + editedContent.substring(end);
    setEditedContent(newContent);
    
    setTimeout(() => {
      if (editorTextareaRef.current) {
        editorTextareaRef.current.focus();
        editorTextareaRef.current.setSelectionRange(start + prefix.length, start + prefix.length + selection.length);
      }
    }, 50);
  };
  
  const [selectedText, setSelectedText] = useState('');
  const [selectionRangeCoords, setSelectionRangeCoords] = useState<{ x: number; y: number } | null>(null);
  const [showClippingModal, setShowClippingModal] = useState(false);
  const [clippingToSave, setClippingToSave] = useState('');
  const [showCopyStatus, setShowCopyStatus] = useState<Record<string, boolean>>({});

  // States for Notebook AI Deepening
  const [isDeepeningItem, setIsDeepeningItem] = useState(false);
  const [deepenedItemResult, setDeepenedItemResult] = useState<{
    text: string;
    itemType: 'highlight' | 'clipping';
    itemId: string;
    itemText: string;
    noteUsed?: string;
    hasDrawingUsed?: boolean;
  } | null>(null);

  // Smart pen / stylus drawing tool state
  const [isPenModeActive, setIsPenModeActive] = useState(false);
  const [showDrawings, setShowDrawings] = useState(true);
  const [penColor, setPenColor] = useState('#FEF08A'); // yellow by default
  const [penThickness, setPenThickness] = useState(14); // slightly thick highlighter by default
  const [penBrushType, setPenBrushType] = useState<'highlight' | 'pen' | 'eraser'>('highlight');

  // Highlight Notes Block State
  const [selectedHighlightForNote, setSelectedHighlightForNote] = useState<{ id: string; text: string; color: string; note?: string } | null>(null);
  const [highlightNoteText, setHighlightNoteText] = useState('');

  // Remaining time prediction for notebook AI deepening generation (starts at 25 seconds estimate)
  const [deepeningSecondsRemaining, setDeepeningSecondsRemaining] = useState(25);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isDeepeningItem) {
      setDeepeningSecondsRemaining(25);
      interval = setInterval(() => {
        setDeepeningSecondsRemaining((prev) => {
          if (prev <= 1) return 1;
          return prev - 1;
        });
      }, 1000);
    } else {
      setDeepeningSecondsRemaining(25);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDeepeningItem]);

  useEffect(() => {
    const userAnns = (userProgress as any)?.topicAnnotations?.[`${localTopic.id}_${depth}`];
    if (userAnns) {
      setHighlights(userAnns.highlights || []);
      setClippings(userAnns.clippings || []);
    } else {
      const legacyAnns = (userProgress as any)?.topicAnnotations?.[localTopic.id];
      if (legacyAnns) {
        setHighlights(legacyAnns.highlights || []);
        setClippings(legacyAnns.clippings || []);
      } else {
        setHighlights(localTopic.highlights || []);
        setClippings(localTopic.clippings || []);
      }
    }
  }, [localTopic.id, localTopic.highlights, localTopic.clippings, userProgress, depth]);

  // Keyboard navigation for illustration search modal
  useEffect(() => {
    if (!showIllustrationSearchModal || searchModalResults.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setSearchModalSelectedId(prev => {
          const currentIndex = searchModalResults.findIndex(r => r.id === prev);
          const nextIndex = currentIndex < searchModalResults.length - 1 ? currentIndex + 1 : 0;
          return searchModalResults[nextIndex]?.id || searchModalResults[0]?.id;
        });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setSearchModalSelectedId(prev => {
          const currentIndex = searchModalResults.findIndex(r => r.id === prev);
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : searchModalResults.length - 1;
          return searchModalResults[prevIndex]?.id || searchModalResults[searchModalResults.length - 1]?.id;
        });
      } else if (e.key === 'Enter') {
        if (document.activeElement?.tagName !== 'INPUT' && searchModalSelectedId) {
          e.preventDefault();
          handleConfirmIllustrationSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIllustrationSearchModal, searchModalResults, searchModalSelectedId]);

  // Handle auto-clear selection when user click elsewhere or scrolls a container
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // If click is inside selection toolbar, interactive model, or is part of saving clipping modal, do not clear
      if (
        target.closest('.selection-toolbar') || 
        target.closest('[role="dialog"]') || 
        showClippingModal
      ) {
        return;
      }
      
      // Use setTimeout so browser completes the click/tap and clears selection before checking selection status
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedStr = selection?.toString().trim() || '';
        
        // If clicked elsewhere with no selection active, clear selection toolbar
        if (selectedStr.length === 0) {
          clearSelection(false); // Do not clear native range, just close the floating toolbar
        }
      }, 0);
    };

    const handleScroll = (e: Event) => {
      // Do not clear selection if dragging/scrolling on tablet in full screen or pen mode active
      if (isPenModeActive || isExpandedViewOpen) {
        return;
      }
      clearSelection(false); // Do not clear native range, just close the floating toolbar
    };

    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('touchstart', handleGlobalClick, { passive: true });
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [showClippingModal, isPenModeActive, isExpandedViewOpen]);

  // Robust selection change event listener of selection changes on desktop & mobile screens
  useEffect(() => {
    let timeoutId: any = null;

    const handleSelectionChange = () => {
      if (isPenModeActive) return;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection) return;

        const text = selection.toString().trim();
        if (text.length > 1) {
          // Confirm selection common ancestor is within the active summary document bounds
          let isInsideTarget = false;
          try {
            if (selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const container = isExpandedViewOpen ? fullscreenScrollRef.current : pdfRef.current;
              if (container && container.contains(range.commonAncestorContainer)) {
                isInsideTarget = true;
              }
            }
          } catch (_) {
            isInsideTarget = true;
          }

          if (!isInsideTarget) return;

          setSelectedText(text);
          try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
              const x = rect.left + rect.width / 2;
              let y = rect.top - 46;
              
              // Boundary safety
              if (y < 60) {
                y = rect.bottom + 12;
              }
              setSelectionRangeCoords({ x, y });
            }
          } catch (err) {
            console.warn('[SelectionChange] Fail to get bounding rect:', err);
          }
        } else {
          // Skip clearing if we are inside search filter inputs or clipping inputs
          const activeEl = document.activeElement;
          const isInteractingWithToolbarInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.closest('.selection-toolbar'));
          if (isInteractingWithToolbarInput || showClippingModal) {
            return;
          }
          setSelectedText('');
          setSelectionRangeCoords(null);
        }
      }, 150); // 150ms debounce to eliminate real-time dragging lag
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isPenModeActive, isExpandedViewOpen, showClippingModal]);

  const handleTextSelection = (e?: React.MouseEvent | React.TouchEvent) => {
    // If drawing mode is active, do not trigger text selection floating bubble
    if (isPenModeActive) return;

    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (text.length > 1) {
      setSelectedText(text);
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          const x = rect.left + rect.width / 2;
          let y = rect.top - 46;
          
          if (y < 60) {
            y = rect.bottom + 12;
          }
          setSelectionRangeCoords({ x, y });
          return;
        }
      } catch (err) {
        console.warn('Fallback selection trigger geometry:', err);
      }

      // Safe backup positioning
      if (e) {
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2 - 100;
        
        if ('clientX' in e && (e as React.MouseEvent).clientX !== undefined) {
          const mouseEv = e as React.MouseEvent;
          x = mouseEv.clientX;
          y = mouseEv.clientY - 40;
        } else if ('changedTouches' in e && (e as React.TouchEvent).changedTouches && (e as React.TouchEvent).changedTouches.length > 0) {
          const touchEv = e as React.TouchEvent;
          x = touchEv.changedTouches[0].clientX;
          y = touchEv.changedTouches[0].clientY - 40;
        }
        setSelectionRangeCoords({ x, y });
      } else {
        setSelectionRangeCoords({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2 - 100
        });
      }
    } else {
      clearSelection(false);
    }
  };

  const clearSelection = (clearNativeSelection = true) => {
    setSelectedText('');
    setSelectionRangeCoords(null);
    if (clearNativeSelection) {
      try {
        window.getSelection()?.removeAllRanges();
      } catch (e) {
        console.log('Error clearing ranges:', e);
      }
    }
  };

  const scrollToText = (text: string, highlightId?: string, clippingOccurrence?: number) => {
    // Determine target container depending on whether fullscreen view is active
    const container = isExpandedViewOpen 
      ? fullscreenScrollRef.current 
      : pdfRef.current;
    
    if (!container) return;

    if (highlightId) {
      const element = container.querySelector(`[data-highlight-id="${highlightId}"]`) as HTMLElement | null;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash / highlight effect
        element.classList.add('ring-[3px]', 'ring-[#D44E3D]/50', 'transition-all', 'duration-300');
        setTimeout(() => {
          element.classList.remove('ring-[3px]', 'ring-[#D44E3D]/50');
        }, 2000);
        return;
      }
    }

    // High fidelity search: find all text-containing elements and pick the deepest/most specific target
    const elements = Array.from(container.querySelectorAll('p, li, h1, h2, h3, h4, span, strong, em, code, pre'));
    let targetElement: HTMLElement | null = null;
    
    // Sort elements by content length ascending so we check more specific/smaller elements first!
    const matches = elements
      .map(el => el as HTMLElement)
      .filter(el => {
        const cleanElText = el.innerText?.replace(/\s+/g, ' ').toLowerCase() || '';
        const cleanSearchText = text.replace(/\s+/g, ' ').toLowerCase();
        return cleanElText.includes(cleanSearchText);
      });
      
    if (matches.length > 0) {
      if (clippingOccurrence !== undefined) {
        const orderedMatches = matches.sort((a, b) => {
          return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
        targetElement = orderedMatches[Math.min(clippingOccurrence, orderedMatches.length - 1)] || orderedMatches[0];
      } else {
        // Pick the matched element with shortest innerText length (most specific/deepest)
        matches.sort((a, b) => (a.innerText?.length || 0) - (b.innerText?.length || 0));
        targetElement = matches[0];
      }
    }

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetElement.classList.add('bg-[#FEF08A]/70', 'transition-all', 'duration-300');
      setTimeout(() => {
        targetElement.classList.remove('bg-[#FEF08A]/70');
      }, 2500);
    } else {
      // Paragraph-level fallback (case-insensitive)
      const paragraphs = container.querySelectorAll('p, li, h1, h2, h3, h4');
      for (const p of Array.from(paragraphs)) {
        const cleanPText = p.textContent?.replace(/\s+/g, ' ').toLowerCase() || '';
        const cleanSearchText = text.replace(/\s+/g, ' ').toLowerCase();
        if (cleanPText.includes(cleanSearchText)) {
          p.scrollIntoView({ behavior: 'smooth', block: 'center' });
          p.classList.add('bg-stone-100', 'transition-all', 'duration-300');
          setTimeout(() => {
            p.classList.remove('bg-stone-100');
          }, 2500);
          break;
        }
      }
    }
  };

  const saveAnnotations = async (updatedHighlights: any[], updatedClippings: any[], updatedIllustrations?: any[]) => {
    const targetIllustrations = updatedIllustrations !== undefined ? updatedIllustrations : illustrations;
    const annotationsKey = `${topic.id}_${depth}`;
    const newAnnotations = {
      ...(userProgress?.topicAnnotations || {}),
      [annotationsKey]: {
        highlights: updatedHighlights,
        clippings: updatedClippings,
        illustrations: targetIllustrations,
        lastUpdated: new Date().toISOString()
      }
    };

    if (onProgressUpdate && userProgress) {
      onProgressUpdate({
        topicAnnotations: newAnnotations
      });
    }

    try {
      const userProgressRef = doc(db, 'userProgress', userId);
      const updateData = {
        [`topicAnnotations.${topic.id}_${depth}.highlights`]: updatedHighlights,
        [`topicAnnotations.${topic.id}_${depth}.clippings`]: updatedClippings,
        [`topicAnnotations.${topic.id}_${depth}.illustrations`]: targetIllustrations,
        [`topicAnnotations.${topic.id}_${depth}.lastUpdated`]: new Date().toISOString()
      };
      await updateDoc(userProgressRef, updateData);
    } catch (err) {
      console.error('Error saving user annotations to userProgress:', err);
      try {
        await updateDoc(getTopicDocRef(), {
          [`highlights_${depth}`]: updatedHighlights,
          [`clippings_${depth}`]: updatedClippings,
          [`illustrations_${depth}`]: targetIllustrations,
          lastUpdated: new Date().toISOString()
        });
      } catch (errFallback) {
        console.error('Fallback save to topic also failed:', errFallback);
      }
    }
  };

  const applyHighlight = async (color: string) => {
    if (!selectedText) return;
    
    let occurrence = 0;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      try {
        const range = selection.getRangeAt(0);
        const container = isExpandedViewOpen ? fullscreenScrollRef.current : pdfRef.current;
        if (container) {
          const preRange = document.createRange();
          preRange.selectNodeContents(container);
          preRange.setEnd(range.startContainer, range.startOffset);
          
          const preText = preRange.toString();
          const escapedText = selectedText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const matches = preText.match(new RegExp(escapedText, 'gi'));
          occurrence = matches ? matches.length : 0;
        }
      } catch (err) {
        console.warn('Error calculating highlight occurrence index:', err);
      }
    }
    
    const existingIndex = highlights.findIndex(hl => hl.text === selectedText && hl.occurrence === occurrence);
    let updatedHighlights = [...highlights];
    
    if (existingIndex !== -1) {
      updatedHighlights[existingIndex] = { ...updatedHighlights[existingIndex], color };
    } else {
      updatedHighlights.push({
        id: Math.random().toString(36).substr(2, 9),
        text: selectedText,
        color,
        occurrence
      });
    }
    
    setHighlights(updatedHighlights);
    clearSelection();
    await saveAnnotations(updatedHighlights, clippings);
  };

  const removeHighlight = async (hlId: string) => {
    const updatedHighlights = highlights.filter(hl => hl.id !== hlId);
    setHighlights(updatedHighlights);
    await saveAnnotations(updatedHighlights, clippings);
  };

  const handleDeleteHighlight = (e: React.MouseEvent, hlId: string) => {
    e.stopPropagation();
    const confirmRemove = confirm('Deseja remover este grifo?');
    if (confirmRemove) {
      removeHighlight(hlId);
    }
  };

  const handleSaveClippingPopup = () => {
    setClippingToSave(selectedText);
    setShowClippingModal(true);
    setSelectedText('');
    setSelectionRangeCoords(null);
  };

  const saveClipping = async (category: string) => {
    if (!clippingToSave) return;
    
    let occurrence = 0;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      try {
        const range = selection.getRangeAt(0);
        const container = isExpandedViewOpen ? fullscreenScrollRef.current : pdfRef.current;
        if (container) {
          const preRange = document.createRange();
          preRange.selectNodeContents(container);
          preRange.setEnd(range.startContainer, range.startOffset);
          
          const preText = preRange.toString();
          const escapedText = clippingToSave.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const matches = preText.match(new RegExp(escapedText, 'gi'));
          occurrence = matches ? matches.length : 0;
        }
      } catch (err) {
        console.warn('Error calculating clipping occurrence index:', err);
      }
    }

    const newClipping = {
      id: Math.random().toString(36).substr(2, 9),
      text: clippingToSave,
      category,
      occurrence,
      createdAt: new Date().toISOString()
    };
    
    const updatedClippings = [...clippings, newClipping];
    setClippings(updatedClippings);
    setClippingToSave('');
    setShowClippingModal(false);
    clearSelection();
    await saveAnnotations(highlights, updatedClippings);
  };

  const removeClipping = async (clId: string) => {
    const updatedClippings = clippings.filter(c => c.id !== clId);
    setClippings(updatedClippings);
    await saveAnnotations(highlights, updatedClippings);
  };

  const handleCopyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateRealPix = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingPix(true);
    setPaymentError('');
    try {
      const targetEmail = userEmail || 'usuario@medrevise.com.br';
      const cleanCpf = cpf.replace(/\D/g, '');
      if (!cleanCpf || cleanCpf.length !== 11) {
        throw new Error('O CPF do titular é obrigatório para a emissão do Pix e deve conter exatamente 11 números.');
      }

      console.log('[MercadoPago Pix TopicDetail] Dispatching payload to Backend...');
      const res = await fetch('/api/mercadopago/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          email: targetEmail,
          cpf: cleanCpf,
          firstName: firstName || 'Estudante',
          lastName: lastName || 'Medicina',
          planType: selectedPlanForUpgrade
        })
      });

      if (!res.ok) {
        let errMsg = 'Erro na comunicação do servidor de faturamento Pix.';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.qr_code) {
        setPixQrCode(data.qr_code);
        setPixQrBase64(data.qr_code_base64 || '');
        setPixPaymentId(data.id || '');
        setPixGenerated(true);
        setTimeLeft(900); // Reset countdown
      } else {
        throw new Error('Retorno da transação inválido pelo Mercado Pago.');
      }
    } catch (err: any) {
      console.error('[Pix Payment Creation Error]', err);
      setPaymentError(err?.message || 'Erro ao gerar Pix de cobrança. Verifique as credenciais ou dados.');
    } finally {
      setGeneratingPix(false);
    }
  };

  const handleCheckPixStatus = async () => {
    setCheckingStatus(true);
    setCheckingStatusMessage('Consultando compensação bancária em tempo real...');
    try {
      if (pixPaymentId) {
        console.log('[Check Pix Status TopicDetail] Querying backend check-payment endpoint for paymentId:', pixPaymentId);
        const res = await fetch(`/api/mercadopago/check-payment/${pixPaymentId}?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isPremium || data.status === 'approved') {
            try {
              const userRef = doc(db, 'users', userId);
              await updateDoc(userRef, {
                isPremium: true,
                premiumPlan: selectedPlanForUpgrade,
                premiumPaymentId: String(pixPaymentId),
                premiumProvider: 'MercadoPago',
                updatedAt: new Date().toISOString()
              });
              console.log('[Check Pix Status TopicDetail] Updated user doc on client side successfully.');
            } catch (clientErr) {
              console.error('[Check Pix Status] Client-side Firestore update error:', clientErr);
            }
            setCheckingStatusMessage('✓ Sucesso de compensação detectado! Conta atualizada para Pro/Premium.');
            setCheckingStatus(false);
            await fetchQuota();
            setTimeout(() => {
              setShowSubscriptionModal(false);
            }, 2000);
            return;
          }
        }
      }

      // Fallback
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (snap.exists() && snap.data()?.isPremium) {
        setCheckingStatusMessage('✓ Sucesso de compensação detectado! Conta atualizada para Pro/Premium.');
        await fetchQuota();
        setTimeout(() => {
          setShowSubscriptionModal(false);
        }, 2000);
      } else {
        setCheckingStatusMessage('✗ Recebimento pendente ou em análise. Tente novamente em alguns segundos.');
      }
    } catch (err) {
      console.error('[Check status error]', err);
      setCheckingStatusMessage('Erro de conexão ao verificar recebimento.');
    } finally {
      setCheckingStatus(false);
      setTimeout(() => setCheckingStatusMessage(''), 8000);
    }
  };

  const handleRealCheckout = async () => {
    setProcessingPayment(true);
    setPaymentError('');
    setCheckoutUrl('');
    try {
      const targetEmail = userEmail || 'usuario@medrevise.com.br';
      console.log('[MercadoPago TopicDetail] Initiating preference creation via endpoint...');
      const res = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          email: targetEmail,
          planType: selectedPlanForUpgrade
        })
      });

      if (!res.ok) {
        let errMsg = 'Não foi possível registrar a preferência de pagamento no servidor.';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.init_point) {
        console.log('[MercadoPago TopicDetail] Redirecting user to:', data.init_point);
        setCheckoutUrl(data.init_point);
        
        const mpWindow = window.open(data.init_point, '_blank');
        if (!mpWindow || mpWindow.closed || typeof mpWindow.closed === 'undefined') {
          console.warn('[MercadoPago TopicDetail] Popup blocker detected or active sandbox restriction.');
        }
      } else {
        throw new Error('Endpoint de pagamento não retornou um link de checkout válido.');
      }
    } catch (err: any) {
      console.error('[Checkout Error]', err);
      setPaymentError(err?.message || 'Erro de comunicação ao contactar Mercado Pago. Tente novamente.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOpenIllustrationSearchModal = (queryTerm: string, replacingId: string | null = null) => {
    const defaultQuery = queryTerm || selectedText || '';
    setSearchModalQuery(defaultQuery);
    setSearchModalReplacingId(replacingId);
    setShowIllustrationSearchModal(true);
    setSearchModalSourceBooks(true);
    setSearchModalSourceArticles(true);
    setSearchModalSelectedId(null);
    setSearchModalResults([]);
    setSelectedInsertionSectionId('auto');
    setModalStep('select_image');
    
    // Automatically trigger search
    handleSearchScientificImages(defaultQuery);
  };

  const handleSearchScientificImages = async (queryStr: string, useAi: boolean = false) => {
    if (!queryStr || queryStr.trim().length < 2) return;
    setSearchModalLoading(true);
    if (useAi) setSearchModalAiLoading(true);
    setSearchModalResults([]);
    setSearchModalSelectedId(null);
    
    try {
      if (useAi) {
        if ((globalQuota?.available ?? 0) < 1) {
          alert('Você não tem créditos suficientes para otimizar com IA.');
          return;
        }
      }

      let results: any[] = [];
      const cleanQuery = queryStr.trim();
      const lowerQuery = cleanQuery.toLowerCase();
      
      let queryTermsToSearch: string[] = [];
      let ptTerm = cleanQuery;
      
      if (useAi) {
        try {
          const aiPrompt = `O usuário deseja encontrar imagens médicas ou achados clínicos REAIS para a consulta médica: "${cleanQuery}".
Gere 6 a 8 termos de busca altamente específicos e COMPOSTOS em INGLÊS para repositórios acadêmicos internacionais (NLM, PubMed, Open-i, PLOS, Wikimedia Commons).
DIRETRIZES CRÍTICAS PARA PRECISÃO DA PATOLOGIA:
1. SEMPRE combine o nome da patologia/doença com o achado visual (ex: "trichomoniasis strawberry cervix", "vulvovaginal candidiasis discharge", "bacterial vaginosis clue cells", "acute cervicitis endocervix", "chlamydia cervicitis").
2. NUNCA gere palavras isoladas ou ambíguas.
Retorne APENAS os termos separados por vírgula.`;
          const aiResponse = await generateWithAI(aiPrompt, "gemini-3.1-flash-lite", 1);
          if (aiResponse) {
            queryTermsToSearch = aiResponse.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          }
        } catch (err: any) {
          console.warn("AI failed to optimize search", err);
        } finally {
          await fetchQuota(); 
        }
      }
      
      // Always include exact mapped English term and clean query
      const enTerm = getEnglishMedicalTerm(ptTerm);
      if (enTerm && enTerm !== ptTerm && !queryTermsToSearch.includes(enTerm)) {
        queryTermsToSearch.unshift(enTerm);
      }
      if (!queryTermsToSearch.includes(ptTerm)) {
        queryTermsToSearch.unshift(ptTerm);
      }
      
      // Add expanded medical terms
      const expanded = expandSearchTerms([ptTerm]);
      expanded.forEach(t => {
        if (t && t.length > 3 && !queryTermsToSearch.includes(t) && queryTermsToSearch.length < 10) {
          queryTermsToSearch.push(t);
        }
      });

      // 1. MATCH VERIFIED CLINICAL MANUALS ATLAS (GUARANTEED ACCURACY)
      const queryWords = lowerQuery.split(/[\s,/-]+/).filter(w => w.length > 2);
      const verifiedManualMatches: any[] = [];

      VERIFIED_CLINICAL_MANUALS_ATLAS.forEach(manualItem => {
        const matchesKeyword = manualItem.keywords.some(kw => {
          const lowerKw = kw.toLowerCase();
          return lowerQuery.includes(lowerKw) || queryWords.some(qw => lowerKw.includes(qw));
        });
        if (matchesKeyword) {
          verifiedManualMatches.push({ ...manualItem });
        }
      });

      // Domain context detection for filtering and society manual attribution
      const lowerPT = ptTerm.toLowerCase();
      const isGyneco = lowerPT.includes('corrimento') || lowerPT.includes('cervicite') || lowerPT.includes('vaginite') || lowerPT.includes('vaginose') || lowerPT.includes('candidíase') || lowerPT.includes('candidiase') || lowerPT.includes('tricomoníase') || lowerPT.includes('tricomoniase') || lowerPT.includes('colo') || lowerPT.includes('utero') || lowerPT.includes('útero') || lowerPT.includes('vagina') || lowerPT.includes('ginec');
      const isDerma = lowerPT.includes('dermatolo') || lowerPT.includes('pele') || lowerPT.includes('lesão') || lowerPT.includes('lesao') || lowerPT.includes('eritema') || lowerPT.includes('exantema') || lowerPT.includes('psoríase') || lowerPT.includes('psoriase');
      const isRadio = lowerPT.includes('raio-x') || lowerPT.includes('tomografia') || lowerPT.includes('tc ') || lowerPT.includes('ressonância') || lowerPT.includes('rm ') || lowerPT.includes('ultrassom') || lowerPT.includes('radiografia');
      const isCardio = lowerPT.includes('cardio') || lowerPT.includes('infarto') || lowerPT.includes('iam') || lowerPT.includes('ecg') || lowerPT.includes('eletro') || lowerPT.includes('pericardite') || lowerPT.includes('insuficiência cardíaca');
      const isPneu = lowerPT.includes('pneumo') || lowerPT.includes('pulm') || lowerPT.includes('asma') || lowerPT.includes('dpoc') || lowerPT.includes('pleural');
      const isCirurgia = lowerPT.includes('apendic') || lowerPT.includes('colecist') || lowerPT.includes('hernia') || lowerPT.includes('hérnia') || lowerPT.includes('cirurg');
      const isInfecto = lowerPT.includes('sífilis') || lowerPT.includes('sifilis') || lowerPT.includes('herpes') || lowerPT.includes('hpv') || lowerPT.includes('hiv') || lowerPT.includes('dengue') || lowerPT.includes('infecto');
      const isPediatria = lowerPT.includes('pediatr') || lowerPT.includes('infantil') || lowerPT.includes('bronquiolite');
      const isGastro = lowerPT.includes('gastro') || lowerPT.includes('fígado') || lowerPT.includes('figado') || lowerPT.includes('cirrose') || lowerPT.includes('úlcera') || lowerPT.includes('ulcera') || lowerPT.includes('ascite');
      const isNeuro = lowerPT.includes('neuro') || lowerPT.includes('avc') || lowerPT.includes('meningite') || lowerPT.includes('convulsão');
      const isReumato = lowerPT.includes('reumato') || lowerPT.includes('artrite') || lowerPT.includes('lúpus') || lowerPT.includes('lupus') || lowerPT.includes('gota');
      const isEndocrino = lowerPT.includes('endocrino') || lowerPT.includes('diabetes') || lowerPT.includes('tireoide') || lowerPT.includes('tireóide');
      const isNefro = lowerPT.includes('nefro') || lowerPT.includes('rim') || lowerPT.includes('renal') || lowerPT.includes('glomerulo');

      // Fetcher for NLM Open-i (National Library of Medicine - Clinical Cases & Radiology)
      const fetchOpenI = async () => {
        const openIResults: any[] = [];
        try {
          const termsToUse = queryTermsToSearch.slice(0, 3);
          for (const qTerm of termsToUse) {
            const url = `/api/proxy-scientific?source=openi&query=${encodeURIComponent(qTerm)}&limit=10`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            const list = data.list || [];
            list.forEach((item: any, idx: number) => {
              const imgUrl = item.imgLarge || item.imgThumb;
              if (!imgUrl) return;

              let sourceName = "Open-i (National Library of Medicine / NIH)";
              if (item.coll === 'medpix') sourceName = "MedPix (NLM Radiology & Clinical Cases)";
              else if (item.coll === 'pmc') sourceName = "PubMed Central (Artigo Peer-Reviewed)";

              let displayTitle = item.title || `Caso Clínico: ${qTerm}`;
              if (displayTitle.length > 80) displayTitle = displayTitle.substring(0, 77) + '...';

              const fullText = (displayTitle + " " + (item.abstract || '')).toLowerCase();

              // Strict Domain Relevance Filter
              if (isGyneco) {
                const gyneKeywords = ['vagina', 'cervix', 'cervicitis', 'vaginitis', 'vaginosis', 'discharge', 'candidiasis', 'trichomon', 'colposcopy', 'gynecolog', 'pap smear', 'vulva', 'leukorrhea', 'colpitis', 'endocervix', 'exocervix', 'uterus', 'pelvic'];
                const hasGyneKeyword = gyneKeywords.some(k => fullText.includes(k));
                const unrelatedKeywords = ['heart', 'lung', 'brain', 'skull', 'fracture', 'knee', 'liver', 'spleen', 'dental', 'teeth', 'eye', 'cornea'];
                const hasUnrelated = unrelatedKeywords.some(k => fullText.includes(k));
                if (!hasGyneKeyword || hasUnrelated) return;
              } else if (isDerma) {
                const dermaKeywords = ['skin', 'dermatol', 'lesion', 'rash', 'erythema', 'epiderm', 'cutan', 'pustule', 'papule', 'nevus', 'melanoma', 'eczema', 'psoriasis'];
                if (!dermaKeywords.some(k => fullText.includes(k))) return;
              }

              openIResults.push({
                id: `oi-${item.uid || item.pmcid || idx}-${idx}`,
                title: displayTitle,
                url: imgUrl,
                thumbUrl: item.imgThumb || imgUrl,
                sourceType: 'article',
                sourceName,
                specialty: "Relato de Caso & Atlas NLM/NIH",
                authors: item.authors || "NLM Medical Board",
                caption: item.abstract || `Achado clínico/figura de artigo médico referente a ${qTerm}.`,
                score: 120
              });
            });
          }
        } catch (err) {
          console.warn('Open-i fetch failed', err);
        }
        return openIResults;
      };

      // Fetcher for PLOS Open Access Medical Journals
      const fetchPLOS = async () => {
        const plosResults: any[] = [];
        try {
          const qTerm = queryTermsToSearch[0] || ptTerm;
          const url = `/api/proxy-scientific?source=plos&query=${encodeURIComponent(qTerm)}&limit=10`;
          const res = await fetch(url);
          if (!res.ok) return [];
          const data = await res.json();
          const docs = data.response?.docs || [];
          docs.forEach((item: any, idx: number) => {
            if (item.id) {
              const doi = item.id;
              const figUrl = `https://journals.plos.org/plosone/article/figure/image?id=${doi}.g001&size=medium`;
              const title = item.title_display || `Figura Clínica - ${qTerm}`;
              const fullText = (title + " " + (item.abstract || '')).toLowerCase();

              if (isGyneco) {
                const gyneKeywords = ['vagina', 'cervix', 'cervicitis', 'vaginitis', 'vaginosis', 'discharge', 'candidiasis', 'trichomon', 'colposcopy', 'gynecolog', 'vulva'];
                if (!gyneKeywords.some(k => fullText.includes(k))) return;
              }

              plosResults.push({
                id: `plos-${doi.replace(/[^a-z0-9]/gi, '_')}-${idx}`,
                title: title.length > 80 ? title.substring(0, 77) + '...' : title,
                url: figUrl,
                thumbUrl: figUrl,
                sourceType: 'article',
                sourceName: `${item.journal || 'PLOS Medicine'} (Revista Científica)`,
                specialty: "Artigo Médico Peer-Reviewed",
                authors: Array.isArray(item.author_display) ? item.author_display.join(', ') : (item.author_display || 'Pesquisadores Médicos'),
                caption: `Ilustração clínica de estudo publicado em ${item.journal || 'PLOS Medicine'}.`,
                score: 110
              });
            }
          });
        } catch (err) {
          console.warn('PLOS fetch failed', err);
        }
        return plosResults;
      };

      // Specialized Wikimedia Commons Medical Search
      const fetchWikimedia = async () => {
        const wikimediaResults: any[] = [];
        try {
          const promises = queryTermsToSearch.slice(0, 6).map(async (qTerm, qIdx) => {
            const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(qTerm)}&gsrnamespace=6&prop=imageinfo|categories&cllimit=15&iiprop=url|extmetadata&iiurlwidth=500&gsrlimit=12&format=json&origin=*`;
            const res = await fetch(url);
            if (!res.ok) return [];
            const data = await res.json();
            const pages = data.query?.pages || {};
            const candidates = Object.values(pages) as any[];
            
            return candidates.map((cand: any, idx: number) => {
              const imgUrl = cand.imageinfo?.[0]?.url;
              const thumbUrl = cand.imageinfo?.[0]?.thumburl || imgUrl;
              if (!imgUrl || !/\.(jpg|jpeg|png|gif|svg|webp)/i.test(imgUrl)) return null;

              const rawTitle = cand.title || '';
              const cleanFileTitle = rawTitle.replace(/^file:/i, '').replace(/\.[a-z0-9]+$/i, '').replace(/[\s_-]+/g, ' ').trim();
              const fullText = (cleanFileTitle + " " + (cand.imageinfo?.[0]?.extmetadata?.ImageDescription?.value || '') + " " + (cand.categories?.map((c: any) => c.title).join(' ') || '')).toLowerCase();

              // Domain Relevance Filter
              if (isGyneco) {
                const gyneKeywords = ['vagina', 'cervix', 'cervicitis', 'vaginitis', 'vaginosis', 'discharge', 'candidiasis', 'trichomon', 'colposcopy', 'gynecolog', 'pap smear', 'vulva', 'leukorrhea', 'colpitis', 'endocervix', 'exocervix', 'uterus', 'pelvic'];
                const hasGyneKeyword = gyneKeywords.some(k => fullText.includes(k));
                const unrelatedKeywords = ['heart', 'lung', 'brain', 'skull', 'fracture', 'knee', 'liver', 'spleen', 'dental', 'teeth', 'eye', 'cornea'];
                const hasUnrelated = unrelatedKeywords.some(k => fullText.includes(k));
                if (!hasGyneKeyword || hasUnrelated) return null;
              } else if (isDerma) {
                const dermaKeywords = ['skin', 'dermatol', 'lesion', 'rash', 'erythema', 'epiderm', 'cutan', 'pustule', 'papule', 'nevus', 'melanoma', 'eczema', 'psoriasis'];
                const hasDermaKeyword = dermaKeywords.some(k => fullText.includes(k));
                if (!hasDermaKeyword || fullText.includes('radiograph')) return null;
              }

              const baseScore = scoreMedicalCandidate(cand, qTerm);
              let bonus = 0;
              const lowerQ = qTerm.toLowerCase();
              if (fullText.includes(lowerQ)) bonus += 30;
              
              const score = baseScore + bonus;

              let sourceName = "Manual Acadêmico / Wikimedia Commons Atlas";
              let specialty = "Atlas Clínico de Especialidade";
              let authors = cand.imageinfo?.[0]?.extmetadata?.Artist?.value || "Colaborador Médico";
              authors = authors.replace(/<[^>]+>/g, '').trim();
              if (authors.length > 40) authors = authors.substring(0, 37) + '...';

              if (isGyneco) {
                sourceName = "Manual de Ginecologia e Obstetrícia (FEBRASGO / PCDT MS)";
                specialty = "Ginecologia e Obstetrícia";
              } else if (isDerma) {
                sourceName = "Atlas de Dermatologia Clínica (SBD / DermNet)";
                specialty = "Dermatologia";
              } else if (isRadio) {
                sourceName = "Colégio Brasileiro de Radiologia (CBR / Radiopaedia)";
                specialty = "Radiologia e Diagnóstico por Imagem";
              } else if (isCardio) {
                sourceName = "Diretrizes de Cardiologia (SBC / AHA)";
                specialty = "Cardiologia";
              } else if (isPneu) {
                sourceName = "Manual de Pneumologia e Tisiologia (SBPT / GOLD)";
                specialty = "Pneumologia";
              } else if (isCirurgia) {
                sourceName = "Manual de Urgências Cirúrgicas (CBC / SBAIT)";
                specialty = "Cirurgia Geral";
              } else if (isInfecto) {
                sourceName = "Guia de Vigilância e Infectologia (SBI / Ministério da Saúde)";
                specialty = "Infectologia";
              } else if (isPediatria) {
                sourceName = "Tratado de Pediatria (SBP)";
                specialty = "Pediatria";
              } else if (isGastro) {
                sourceName = "Manual de Gastroenterologia e Hepatologia (FBG / SBH)";
                specialty = "Gastroenterologia";
              } else if (isNeuro) {
                sourceName = "Manual de Neurologia Clínica (ABN)";
                specialty = "Neurologia";
              } else if (isReumato) {
                sourceName = "Diretrizes da Sociedade Brasileira de Reumatologia (SBR)";
                specialty = "Reumatologia";
              } else if (isEndocrino) {
                sourceName = "Manual de Endocrinologia e Metabologia (SBEM)";
                specialty = "Endocrinologia";
              } else if (isNefro) {
                sourceName = "Manual de Nefrologia Clínica (SBN)";
                specialty = "Nefrologia";
              }

              let displayTitle = cleanFileTitle;
              if (displayTitle.length > 75) displayTitle = displayTitle.substring(0, 72) + '...';

              return {
                id: `wm-${cand.pageid || idx}-${qIdx}-${idx}`,
                title: displayTitle,
                url: imgUrl,
                thumbUrl: thumbUrl,
                sourceType: 'book',
                sourceName,
                specialty,
                authors,
                caption: cand.imageinfo?.[0]?.extmetadata?.ImageDescription?.value?.replace(/<[^>]+>/g, '') || `Achado visual clínico referente a ${qTerm}.`,
                score
              };
            }).filter(Boolean);
          });
          const resultsArr = await Promise.all(promises);
          resultsArr.forEach(arr => wikimediaResults.push(...arr));
        } catch (err) {
          console.warn('Wikimedia fetch failed', err);
        }
        return wikimediaResults;
      };

      const [openIRes, plosRes, wmRes] = await Promise.all([
        fetchOpenI(),
        fetchPLOS(),
        fetchWikimedia()
      ]);

      const allWebResults = [...openIRes, ...plosRes, ...wmRes];

      // Combine: Verified Manual Atlas items FIRST (highest score 300), followed by filtered web items
      const combined = [...verifiedManualMatches, ...allWebResults];

      // Combine and remove duplicates by URL and ensure unique IDs
      const seenUrls = new Set();
      const seenIds = new Set();
      
      results = combined
        .filter(item => {
          if (!item || !item.url || !item.id) return false;
          const normUrl = item.url.split('?')[0].split('#')[0].toLowerCase();
          if (seenUrls.has(normUrl) || seenIds.has(item.id)) return false;
          seenUrls.add(normUrl);
          seenIds.add(item.id);
          return true;
        })
        .sort((a: any, b: any) => b.score - a.score);

      // AI VERIFICATION FILTER (If useAi is active, filter out false positives with Gemini)
      if (useAi && results.length > 0) {
        try {
          const candidatesToVerify = results.slice(0, 15).map((r, i) => `${i}: "${r.title}" - ${r.caption || ''}`);
          const filterPrompt = `Você é um validador médico rigoroso. A busca do usuário é pela condição clínica: "${cleanQuery}".
Analise os seguintes candidatos de imagens médicas e retorne APENAS OS ÍNDICES NUMÉRICOS daqueles que REALMENTE correspondem a esta patologia/achado clínico.
Candidatos:
${candidatesToVerify.join('\n')}

Responda APENAS com os números separados por vírgula (exemplo: 0,1,3). Se todos forem válidos ou se na dúvida, inclua o índice.`;

          const aiFilterResponse = await generateWithAI(filterPrompt, "gemini-3.1-flash-lite", 1);
          if (aiFilterResponse) {
            const validIndices = aiFilterResponse.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0 && n < results.length);
            if (validIndices.length > 0) {
              const verifiedSet = new Set(validIndices);
              results = results.filter((_, idx) => verifiedSet.has(idx) || idx < verifiedManualMatches.length);
            }
          }
        } catch (err) {
          console.warn("AI Candidate verification failed, falling back to score-sorted results", err);
        }
      }

      setSearchModalResults(results);
      if (results.length > 0) {
        setSearchModalSelectedId(results[0].id);
      }
    } catch (err) {
      console.error('General search error:', err);
    } finally {
      setSearchModalLoading(false);
      setSearchModalAiLoading(false);
    }
  };

  const handleConfirmIllustrationSelection = async () => {
    const selectedItem = searchModalResults.find(r => r.id === searchModalSelectedId);
    if (!selectedItem) {
      alert('Por favor, selecione uma imagem.');
      return;
    }
    
    setShowIllustrationSearchModal(false);
    setIsRequestingIllustration(true);
    
    try {
      const term = searchModalQuery || selectedItem.title;
      const foundUrl = selectedItem.url;
      const sourceType = selectedItem.sourceType;
      const bookInfo = {
        title: selectedItem.sourceName,
        authors: selectedItem.authors || ''
      };
      
      if (searchModalReplacingId) {
        // Replace existing illustration
        const updated = illustrations.map(ill => {
          if (ill.id === searchModalReplacingId) {
            return {
              ...ill,
              url: foundUrl,
              sourceType: sourceType === 'book' ? ('book' as const) : ('link' as const),
              bookInfo
            };
          }
          return ill;
        });
        setIllustrations(updated);
        await saveAnnotations(highlights, clippings, updated);
        alert('Ilustração atualizada com sucesso no seu Atlas!');
      } else {
        // Add new illustration
        const newIllustration = {
          id: Math.random().toString(36).substr(2, 9),
          phrase: term,
          url: foundUrl,
          sourceType: sourceType === 'book' ? ('book' as const) : ('link' as const),
          bookInfo,
          createdAt: new Date().toISOString()
        };
        
        const updated = [...illustrations, newIllustration];
        setIllustrations(updated);
        
        // Determine insertion position based on section selection or automatic default
        const contentStr = currentContent || '';
        const { sections, defaultSectionId, defaultHeadingText } = getTopicSectionsAndDefault(contentStr, term);

        let insertIndex = contentStr.length;
        let targetHeadingName = defaultHeadingText;

        const activeSecId = selectedInsertionSectionId === 'auto' ? defaultSectionId : selectedInsertionSectionId;

        if (activeSecId === 'end') {
          insertIndex = contentStr.length;
          targetHeadingName = 'Final do Texto';
        } else {
          const foundSec = sections.find(s => s.id === activeSecId);
          if (foundSec) {
            insertIndex = foundSec.endIndex;
            targetHeadingName = foundSec.headingText;
          } else {
            const defSec = sections.find(s => s.id === defaultSectionId);
            if (defSec) {
              insertIndex = defSec.endIndex;
              targetHeadingName = defSec.headingText;
            }
          }
        }
        
        const captionText = selectedItem.caption || term;
        const sourceText = selectedItem.sourceName || 'Acervo Médico';
        const markdownImageBlock = `\n\n![${term}](${foundUrl})\n*${captionText} (Fonte: ${sourceText})*\n\n`;
        const newContent = contentStr.substring(0, insertIndex) + markdownImageBlock + contentStr.substring(insertIndex);
        
        setCurrentContent(newContent);
        
        const updateFields: any = {
          lastUpdated: new Date().toISOString()
        };
        if (depth === 'standard') {
          updateFields.content_standard = newContent;
          updateFields.content = newContent;
        } else if (depth === 'deep') {
          updateFields.content_deep = newContent;
        } else if (depth === 'elite') {
          updateFields.content_elite = newContent;
        } else if (depth === 'master') {
          updateFields.content_master = newContent;
        } else if (depth === 'monograph') {
          updateFields.content_monograph = newContent;
        } else if (depth === 'custom_analyzed') {
          updateFields.content_custom_analyzed = newContent;
        }
        
        await updateDoc(getTopicDocRef(), updateFields);
        const updatedTopic = { ...topic, ...updateFields };
        setLocalTopic(updatedTopic);
        if (onTopicUpdate) {
          onTopicUpdate(updatedTopic);
        }
        
        await saveAnnotations(highlights, clippings, updated);
        
        setNotebookTab('images');
        setShowNotebook(true);
        clearSelection();
        alert(`Ilustração para "${term}" inserida com sucesso abaixo do subtítulo "${targetHeadingName}"! Ela também foi salva no seu Atlas.`);
      }
    } catch (err: any) {
      console.error('Error in confirm selection:', err);
      alert('Erro ao salvar ilustração selecionada: ' + err.message);
    } finally {
      setIsRequestingIllustration(false);
      setSearchModalReplacingId(null);
      setSearchModalSelectedId(null);
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const hlId = target.getAttribute('data-highlight-id');
    if (hlId) {
      const hl = highlights.find(h => h.id === hlId);
      if (hl) {
        setSelectedHighlightForNote(hl);
        setHighlightNoteText(hl.note || '');
      }
    }
  };

  const handleSaveHighlightNote = async (text: string) => {
    if (!selectedHighlightForNote) return;
    const updated = highlights.map(hl => 
      hl.id === selectedHighlightForNote.id ? { ...hl, note: text } : hl
    );
    setHighlights(updated);
    await saveAnnotations(updated, clippings);
    setSelectedHighlightForNote(null);
  };

  const getHighlightStrokesBase64 = (hlId: string): string | null => {
    try {
      const key = userId ? `smart_pen_drawings_${userId}_highlight_${hlId}` : `smart_pen_drawings_highlight_${hlId}`;
      const saved = safeLocalStorageGet(key);
      if (!saved) return null;
      const strokesList = JSON.parse(saved);
      if (!strokesList || strokesList.length === 0) return null;
      
      const width = 800;
      const height = 600;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      strokesList.forEach((stroke: any) => {
        if (stroke.points.length === 0) return;
        ctx.strokeStyle = stroke.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (stroke.type === 'highlight') {
          ctx.globalAlpha = 0.35;
          ctx.globalCompositeOperation = 'multiply';
        } else {
          ctx.globalAlpha = 0.95;
          ctx.globalCompositeOperation = 'source-over';
        }
        
        if (stroke.points.length < 3) {
          ctx.beginPath();
          const point = stroke.points[0];
          ctx.arc(point.x, point.y, stroke.thickness / 2, 0, Math.PI * 2);
          ctx.fillStyle = stroke.color;
          ctx.fill();
          return;
        }
        
        if (stroke.type === 'highlight') {
          ctx.beginPath();
          ctx.lineWidth = stroke.thickness;
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length - 1; i++) {
            const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
            const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
          }
          ctx.lineTo(stroke.points[stroke.points.length - 1].x, stroke.points[stroke.points.length - 1].y);
          ctx.stroke();
        } else {
          for (let i = 1; i < stroke.points.length; i++) {
            const p1 = stroke.points[i - 1];
            const p2 = stroke.points[i];
            ctx.beginPath();
            const xc = (p1.x + p2.x) / 2;
            const yc = (p1.y + p2.y) / 2;
            ctx.moveTo(p1.x, p1.y);
            ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
            const p1P = p1.pressure !== undefined ? p1.pressure : 0.6;
            const p2P = p2.pressure !== undefined ? p2.pressure : 0.6;
            const currentPressure = (p1P + p2P) / 2;
            ctx.lineWidth = stroke.thickness * (0.35 + currentPressure * 1.0);
            ctx.stroke();
          }
        }
      });
      
      const url = canvas.toDataURL('image/png');
      return url.split(',')[1];
    } catch (e) {
      console.error('Error compiling strokes to base64:', e);
      return null;
    }
  };

  const handleDeepenNotebookItem = async (item: any, itemType: 'highlight' | 'clipping') => {
    const excerptText = item.text || '';
    let typedNotes = '';
    let base64Drawing: string | undefined = undefined;
    
    if (itemType === 'highlight') {
      typedNotes = item.note || '';
      const b64 = getHighlightStrokesBase64(item.id);
      if (b64) {
        base64Drawing = b64;
      }
    }
    
    const requiredCredits = base64Drawing ? 5 : 3;
    if (!checkCreditsSufficient(requiredCredits)) {
      return;
    }

    setIsDeepeningItem(true);
    try {
      const responseText = await deepenNotebookArea(
        topic.title,
        currentContent,
        excerptText,
        typedNotes,
        base64Drawing,
        userId
      );
      
      if (responseText) {
        setDeepenedItemResult({
          text: responseText,
          itemType,
          itemId: item.id,
          itemText: excerptText,
          noteUsed: typedNotes || undefined,
          hasDrawingUsed: !!base64Drawing
        });
      }
    } catch (error: any) {
      console.error('Error deepening notebook item:', error);
      alert('Erro ao aprofundar com a IA: ' + (error.message || 'Verifique sua cota ou a conexão.'));
    } finally {
      setIsDeepeningItem(false);
    }
  };

  const handleSaveAItoAnnotation = async () => {
    if (!deepenedItemResult) return;
    try {
      const { text, itemId, itemType } = deepenedItemResult;
      
      if (itemType === 'highlight') {
        const updated = highlights.map(hl => {
          if (hl.id === itemId) {
            const separator = hl.note ? '\n\n' : '';
            return {
              ...hl,
              note: `${hl.note || ''}${separator}🧠 **Aprofundamento do Preceptor IA:**\n\n${text}`
            };
          }
          return hl;
        });
        setHighlights(updated);
        await saveAnnotations(updated, clippings);
        
        if (selectedHighlightForNote && selectedHighlightForNote.id === itemId) {
          setHighlightNoteText(prev => `${prev}${prev ? '\n\n' : ''}🧠 **Aprofundamento do Preceptor IA:**\n\n${text}`);
        }
      } else {
        const updated = clippings.map(clip => {
          if (clip.id === itemId) {
            return {
              ...clip,
              text: `${clip.text}\n\n🧠 **Aprofundamento do Preceptor IA:**\n\n${text}`
            };
          }
          return clip;
        });
        setClippings(updated);
        await saveAnnotations(highlights, updated);
      }
      
      alert('Anotação aprofundada com sucesso no seu caderno!');
      setDeepenedItemResult(null);
    } catch (err) {
      console.error('Error saving AI comment to annotation:', err);
      alert('Erro ao guardar anotação.');
    }
  };

  const handleSaveAItoSummary = async () => {
    if (!deepenedItemResult) return;
    try {
      const { text, itemText } = deepenedItemResult;
      
      const uuid = Math.random().toString(36).substr(2, 9);
      const targetId = `deepening-${uuid}`;
      const linkId = `ref-${uuid}`;
      
      const subtitle = itemText.length > 50 ? `${itemText.substring(0, 50)}...` : itemText;
      
      // Try to weave a hyperlink on the first occurrence of itemText in currentContent
      let updatedMainContent = currentContent;
      const index = updatedMainContent.indexOf(itemText);
      if (index !== -1 && itemText.trim().length > 0) {
        updatedMainContent = 
          updatedMainContent.substring(0, index) + 
          `<span id="${linkId}"><a href="#${targetId}" class="no-underline border-b border-dashed border-orange-500 text-orange-600 hover:text-orange-700 font-bold cursor-pointer" title="Ir para o aprofundamento do Preceptor IA">${itemText} ↗</a></span>` + 
          updatedMainContent.substring(index + itemText.length);
      }
      
      const deepeningBlock = `\n\n---\n\n<div id="${targetId}" class="p-6 my-6 bg-amber-50/40 border-l-4 border-amber-500 rounded-r-2xl shadow-sm leading-relaxed select-text font-serif">\n\n### 🧬 Aprofundamento IA: ${subtitle}\n\n${text}\n\n<div class="mt-4 text-right">\n  <a href="#${linkId}" class="text-xs text-amber-700 font-semibold hover:underline cursor-pointer flex items-center justify-end gap-1">\n    ↩ Voltar ao trecho correspondente no resumo\n  </a>\n</div>\n\n</div>`;
      
      const newContent = `${updatedMainContent}${deepeningBlock}`;
      
      setCurrentContent(newContent);
      
      const updateFields: any = {
        lastUpdated: new Date().toISOString()
      };
      if (depth === 'standard') {
        updateFields.content_standard = newContent;
        updateFields.content = newContent;
      } else if (depth === 'deep') {
        updateFields.content_deep = newContent;
      } else if (depth === 'elite') {
        updateFields.content_elite = newContent;
      } else if (depth === 'master') {
        updateFields.content_master = newContent;
      } else if (depth === 'monograph') {
        updateFields.content_monograph = newContent;
      } else if (depth === 'custom_analyzed') {
        updateFields.content_custom_analyzed = newContent;
      }

      await updateDoc(getTopicDocRef(), updateFields);
      const updated = { ...topic, ...updateFields };
      setLocalTopic(updated);
      
      if (onTopicUpdate) {
        onTopicUpdate(updated);
      }
      
      alert('Aprofundamento clínico incorporado com sucesso com links bidirecionais!');
      setDeepenedItemResult(null);
    } catch (err) {
      console.error('Error saving AI comment to summary:', err);
      alert('Erro ao salvar no resumo.');
    }
  };

  const renderContentWithHighlights = (content: string, hs: typeof highlights) => {
    if (!content) return '';
    if (!hs || hs.length === 0) return content;
    
    let processed = content;
    
    // Sort highlights by length (descending) so we process longer ones first, preventing overlaps
    const sortedHs = [...hs].sort((a, b) => b.text.length - a.text.length);
    
    sortedHs.forEach((hl) => {
      if (!hl.text) return;
      
      // Extract HTML tags temporarily *inside* the loop so newly added <span> tags are also isolated
      const htmlTags: string[] = [];
      processed = processed.replace(/<[^>]+>/g, (match) => {
        htmlTags.push(match);
        return `===HTMLTAGPLACEHOLDER${htmlTags.length - 1}===`;
      });
      
      try {
        const words = hl.text.split(/(\s+)/);
        const regexParts = words.map(part => {
          if (/^\s+$/.test(part)) {
            return '\\s+';
          } else {
            const escapedWord = part.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            return '(?:\\*|_|~)*' + escapedWord + '(?:\\*|_|~)*';
          }
        });
        
        const regexStr = regexParts.join('');
        const regex = new RegExp(regexStr, 'gi');
        
        let matchCount = 0;
        processed = processed.replace(regex, (match) => {
          if (hl.occurrence !== undefined) {
            if (matchCount === hl.occurrence) {
              matchCount++;
              return `<span class="px-1 rounded font-semibold inline cursor-pointer select-text border-b border-[#00000018]" data-highlight-id="${hl.id}" style="background-color: ${hl.color}; color: #111827;" title="Clique para remover grifo">${match}</span>`;
            }
            matchCount++;
            return match;
          } else {
            // Backward compatibility for legacy highlights
            return `<span class="px-1 rounded font-semibold inline cursor-pointer select-text border-b border-[#00000018]" data-highlight-id="${hl.id}" style="background-color: ${hl.color}; color: #111827;" title="Clique para remover grifo">${match}</span>`;
          }
        });
      } catch (e) {
        console.warn('Highlight regex failed:', e);
        try {
          if (hl.occurrence !== undefined) {
            let matchCount = 0;
            const parts = processed.split(hl.text);
            let newProcessed = '';
            for (let i = 0; i < parts.length; i++) {
              newProcessed += parts[i];
              if (i < parts.length - 1) {
                if (matchCount === hl.occurrence) {
                  newProcessed += `<span class="px-1 rounded font-semibold inline cursor-pointer border-b border-[#00000018] select-text" data-highlight-id="${hl.id}" style="background-color: ${hl.color}; color: #111827;" title="Clique para remover grifo">${hl.text}</span>`;
                } else {
                  newProcessed += hl.text;
                }
                matchCount++;
              }
            }
            processed = newProcessed;
          } else {
            processed = processed.replaceAll(hl.text, `<span class="px-1 rounded font-semibold inline cursor-pointer border-b border-[#00000018] select-text" data-highlight-id="${hl.id}" style="background-color: ${hl.color}; color: #111827;" title="Clique para remover grifo">${hl.text}</span>`);
          }
        } catch (err) {
          // ignore
        }
      }
      
      // Restore HTML tags so they are correctly nested for the next loop run or final return
      htmlTags.forEach((tag, idx) => {
        processed = processed.replaceAll(`===HTMLTAGPLACEHOLDER${idx}===`, () => tag);
      });
    });
    
    return processed;
  };

  const CLIPPING_CATEGORIES = [
    { id: 'fisiopatologia', label: '🧬 Fisiopatologia' },
    { id: 'quadro_clinico', label: '🩺 Quadro Clínico' },
    { id: 'diagnostico', label: '🔍 Critérios Diagnósticos' },
    { id: 'conduta', label: '💊 Conduta / Tratamento' },
    { id: 'dicas_prova', label: '🎯 Dicas de Prova / Pegadinhas' },
    { id: 'geral', label: '📝 Notas Gerais' }
  ];

  // Auto-run migration for legacy fields on mount or initial load of topic
  const migrateLegacyTopicFields = async (topicDoc: Topic) => {
    if (topicDoc.importedPdfData) return null;

    const detected = detectRealDepth(topicDoc);
    if (detected === 'none' || detected === 'standard') return null;

    const contentToMigrate = topicDoc.content || '';
    if (!isRealContent(contentToMigrate)) return null;

    const updateFields: any = {};
    if (detected === 'monograph' && !isRealContent(topicDoc.content_monograph)) {
      updateFields.content_monograph = contentToMigrate;
      updateFields.content_standard = ''; 
      updateFields.content = ''; 
    } else if (detected === 'master' && !isRealContent(topicDoc.content_master)) {
      updateFields.content_master = contentToMigrate;
      updateFields.content_standard = '';
      updateFields.content = '';
    } else if (detected === 'elite' && !isRealContent(topicDoc.content_elite)) {
      updateFields.content_elite = contentToMigrate;
      updateFields.content_standard = '';
      updateFields.content = '';
    } else if (detected === 'deep' && !isRealContent(topicDoc.content_deep)) {
      updateFields.content_deep = contentToMigrate;
      updateFields.content_standard = '';
      updateFields.content = '';
    }

    if (Object.keys(updateFields).length > 0) {
      updateFields.lastUpdated = new Date().toISOString();
      try {
        await updateDoc(getTopicDocRef(topicDoc.id), updateFields);
        const migratedData = { ...topicDoc, ...updateFields };
        return migratedData;
      } catch (e) {
        console.error('[Migration] Failed to migrate legacy fields for topic:', e);
      }
    }
    return null;
  };

  useEffect(() => {
    setLocalTopic(initialTopic);
  }, [initialTopic]);

  const lastTopicIdRef = useRef<string | null>(null);

  // Auto-save localTopic state to local storage cache whenever it is updated
  useEffect(() => {
    if (localTopic && localTopic.id) {
      safeLocalStorageSet(`topic_detail_${localTopic.id}`, JSON.stringify(localTopic));
    }
  }, [localTopic]);

  useEffect(() => {
    if (initialTopic.id !== lastTopicIdRef.current) {
      lastTopicIdRef.current = initialTopic.id;
      // Auto-select highest generated depth strictly when loading a new topic ID
      const d = detectRealDepth(initialTopic);
      const storedAnalysis = safeLocalStorageGet('auto_gen_custom_analysis');
      if (storedAnalysis) {
        try {
          const parsed = JSON.parse(storedAnalysis);
          if (parsed && parsed.topicId === initialTopic.id) {
            setAnalysisResult(parsed.analysis);
            setDepth('custom_analyzed');
          } else {
            setDepth(d !== 'none' ? d : 'standard');
          }
        } catch (e) {
          setDepth(d !== 'none' ? d : 'standard');
        }
      } else if (initialTopic.custom_analysis) {
        setAnalysisResult(initialTopic.custom_analysis);
        setDepth('custom_analyzed');
      } else {
        setDepth(d !== 'none' ? d : 'standard');
      }
    }
  }, [initialTopic.id]);

  useEffect(() => {
    if (!localTopic || localTopic.id !== initialTopic.id) return;
    
    const autoGen = safeLocalStorageGet('auto_trigger_generation');
    if (autoGen === 'true') {
      safeLocalStorageRemove('auto_trigger_generation');
      
      const savedDepth = safeLocalStorageGet('auto_gen_depth') as any;
      const savedIllustration = safeLocalStorageGet('auto_gen_illustration') as any;
      const savedAlertBox = safeLocalStorageGet('auto_gen_alert') as any;
      const savedReferences = safeLocalStorageGet('auto_gen_references') || '';
      const customAnalysisStr = safeLocalStorageGet('auto_gen_custom_analysis');
      
      safeLocalStorageRemove('auto_gen_depth');
      safeLocalStorageRemove('auto_gen_illustration');
      safeLocalStorageRemove('auto_gen_alert');
      safeLocalStorageRemove('auto_gen_references');
      
      if (savedDepth) setDepth(savedDepth);
      if (savedIllustration) setIllustrationLevel(savedIllustration);
      if (savedAlertBox) setAlertBoxLevel(savedAlertBox);
      if (savedReferences) setReferencePref(savedReferences);

      if (customAnalysisStr) {
        try {
          const parsed = JSON.parse(customAnalysisStr);
          if (parsed && parsed.topicId === initialTopic.id) {
            setAnalysisResult(parsed.analysis);
          }
        } catch (e) {
          console.error('Error parsing custom analysis:', e);
        }
        safeLocalStorageRemove('auto_gen_custom_analysis');
      }
    }
  }, [localTopic?.id, initialTopic.id]);

  useEffect(() => {
    // Check local storage cache first to save reads
    const cached = safeLocalStorageGet(`topic_detail_${initialTopic.id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Topic;
        if (parsed && parsed.id === initialTopic.id) {
          setLocalTopic(parsed);
          const d = detectRealDepth(parsed);
          setDepth(d !== 'none' ? d : 'standard');
          if (onTopicUpdate) {
            onTopicUpdate(parsed);
          }
          return; // Skip Firestore fetching entirely!
        }
      } catch (e) {
        console.warn('Error parsing cached topic detail:', e);
      }
    }

    // Fetch freshest document ONLY when cache is empty
    const fetchLatestTopic = async () => {
      try {
        const docRef = userId
          ? doc(db, 'users', userId, 'topics', initialTopic.id)
          : doc(db, 'topics', initialTopic.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fetchedData = { id: docSnap.id, ...docSnap.data() } as Topic;
          
          const migrated = await migrateLegacyTopicFields(fetchedData);
          const finalData = migrated || fetchedData;
          
          setLocalTopic(finalData);
          
          // Only auto-select highest generated depth on initial fetch (topic ID mismatch check)
          const d = detectRealDepth(finalData);
          setDepth(d !== 'none' ? d : 'standard');

          if (onTopicUpdate) {
            onTopicUpdate(finalData);
          }
        }
      } catch (err) {
        console.warn('Error fetching latest topic document from Firestore:', err);
      }
    };
    
    fetchLatestTopic();
  }, [initialTopic.id]);

  const getActiveContentByDepth = (currentDepth: GenerationDepth) => {
    const detected = detectRealDepth(topic);
    let result = '';
    switch (currentDepth) {
      case 'standard':
        if (isRealContent(topic.content_standard)) result = topic.content_standard || '';
        else if (detected === 'standard' || detected === 'none') result = topic.content || '';
        break;
      case 'deep':
        if (isRealContent(topic.content_deep)) result = topic.content_deep || '';
        else if (detected === 'deep') result = topic.content_standard || topic.content || '';
        break;
      case 'elite':
        if (isRealContent(topic.content_elite)) result = topic.content_elite || '';
        else if (detected === 'elite') result = topic.content_standard || topic.content || '';
        break;
      case 'master':
        if (isRealContent(topic.content_master)) result = topic.content_master || '';
        else if (detected === 'master') result = topic.content_standard || topic.content || '';
        break;
      case 'monograph':
        if (isRealContent(topic.content_monograph)) result = topic.content_monograph || '';
        else if (detected === 'monograph') result = topic.content_standard || topic.content || '';
        break;
      case 'custom_analyzed':
        if (isRealContent(topic.content_custom_analyzed)) result = topic.content_custom_analyzed || '';
        else if (detected === 'custom_analyzed') result = topic.content_standard || topic.content || '';
        break;
      default:
        result = topic.content_standard || topic.content || '';
    }

    if (isRealContent(result)) {
      return result;
    }

    // Fallback: Check local browser cache saved by user for offline reading
    const cachedDataStr = safeLocalStorageGet(`offline_summary_${topic.id}_${currentDepth}`) || safeLocalStorageGet(`offline_summary_${topic.id}`);
    if (cachedDataStr) {
      try {
        const parsed = JSON.parse(cachedDataStr);
        if (parsed && parsed.content && isRealContent(parsed.content)) {
          return parsed.content;
        }
      } catch (e) {
        if (typeof cachedDataStr === 'string' && isRealContent(cachedDataStr)) {
          return cachedDataStr;
        }
      }
    }

    return result;
  };

  // Sync offline cache status on topic or depth change
  useEffect(() => {
    if (!topic?.id) return;
    const key = `offline_summary_${topic.id}_${depth}`;
    const fallbackKey = `offline_summary_${topic.id}`;
    const exists = !!(safeLocalStorageGet(key) || safeLocalStorageGet(fallbackKey));
    setIsCachedOffline(exists);
  }, [topic?.id, depth]);

  const showOfflineToast = (msg: string) => {
    setOfflineToastMessage(msg);
    setTimeout(() => {
      setOfflineToastMessage(null);
    }, 4500);
  };

  const toggleOfflineCache = () => {
    if (!topic?.id) return;
    const key = `offline_summary_${topic.id}_${depth}`;

    if (isCachedOffline) {
      safeLocalStorageRemove(key);
      safeLocalStorageRemove(`offline_summary_${topic.id}`);
      
      try {
        const indexStr = safeLocalStorageGet('offline_summaries_index');
        if (indexStr) {
          const index = JSON.parse(indexStr);
          delete index[`${topic.id}_${depth}`];
          delete index[topic.id];
          safeLocalStorageSet('offline_summaries_index', JSON.stringify(index));
        }
      } catch (e) {}

      setIsCachedOffline(false);
      showOfflineToast('Resumo removido do cache local do navegador.');
    } else {
      if (!currentContent || !currentContent.trim()) {
        alert('Não há conteúdo no resumo para salvar offline no momento.');
        return;
      }

      const currentSubjectName = subjects.find(s => s.id === topic.subjectId)?.name || '';

      const cacheData = {
        topicId: topic.id,
        title: topic.title,
        depth: depth,
        subjectId: topic.subjectId,
        subjectName: currentSubjectName,
        content: currentContent,
        savedAt: new Date().toISOString()
      };

      const key = `offline_summary_${topic.id}_${depth}`;
      const fallbackKey = `offline_summary_${topic.id}`;

      const success = safeLocalStorageSet(key, JSON.stringify(cacheData));
      safeLocalStorageSet(fallbackKey, JSON.stringify(cacheData));

      if (success) {
        try {
          const indexStr = safeLocalStorageGet('offline_summaries_index');
          const index = indexStr ? JSON.parse(indexStr) : {};
          index[`${topic.id}_${depth}`] = {
            topicId: topic.id,
            title: topic.title,
            depth: depth,
            subjectId: topic.subjectId,
            subjectName: currentSubjectName,
            savedAt: new Date().toISOString()
          };
          index[topic.id] = index[`${topic.id}_${depth}`];
          safeLocalStorageSet('offline_summaries_index', JSON.stringify(index));
        } catch (e) {}

        setIsCachedOffline(true);
        showOfflineToast(`Resumo de "${topic.title}" salvo no cache offline! Disponível sem internet neste navegador.`);
      } else {
        alert('Não foi possível armazenar no cache local (memória do navegador cheia).');
      }
    }
  };

  const fetchQuota = async () => {
    try {
      const quota = await getGlobalUsage();
      const remaining = Math.max(0, quota.limit - quota.count);
      setGlobalQuota({
        available: remaining,
        limit: quota.limit
      });
      if (setAvailableCredits) {
        setAvailableCredits(remaining);
      }
    } catch (error) {
      console.error('Error fetching quota:', error);
    }
  };

  useEffect(() => {
    if (availableCredits !== undefined) {
      setGlobalQuota(prev => ({
        available: availableCredits,
        limit: prev?.limit || 120
      }));
    }
  }, [availableCredits]);

  useEffect(() => {
    fetchQuota();
    // Refresh quota every 2 minutes if generating
    let interval: any;
    if (isGenerating) {
      interval = setInterval(fetchQuota, 120000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    const raw = getActiveContentByDepth(depth);
    if (raw && raw.trim()) {
      const sanitized = sanitizeMarkdown(raw);
      const synced = syncSummaryTableOfContents(sanitized);
      setCurrentContent(synced);
    } else {
      setCurrentContent('');
    }
  }, [depth, topic]);

  useEffect(() => {
    if (currentContent && currentContent.trim().length > 50) {
      const synced = syncSummaryTableOfContents(currentContent);
      if (synced !== currentContent) {
        setCurrentContent(synced);
      }
    }
  }, [currentContent]);

  const checkCreditsSufficient = (requiredCredits: number): boolean => {
    if (globalQuota && globalQuota.available < requiredCredits) {
      setShowSubscriptionModal(true);
      return false;
    }
    return true;
  };

  const getAccountLabel = () => {
    const limit = globalQuota?.limit || 10;
    if (limit >= 1000) return "Administrador / Ilimitado";
    if (limit === 250) return "Combo Ouro";
    if (limit === 200) return "Med Internato Premium";
    return "Med Revise / Grátis";
  };

  const hasErrorInContent = useMemo(() => {
    if (lastGenerationError) return true;
    if (!currentContent) return false;
    const lower = currentContent.toLowerCase();
    return lower.includes('erro na geração') || 
           lower.includes('conteúdo indisponível') || 
           lower.includes('erro de conexão') ||
           lower.includes('falha de rede') ||
           lower.includes('erro de rede') ||
           lower.includes('erro na geracao') ||
           lower.includes('erro de conexao') ||
           lower.includes('falha na geração') ||
           lower.includes('falha na geracao') ||
           lower.includes('instabilidade de conexão') ||
           lower.includes('falha ao gerar');
  }, [currentContent, lastGenerationError]);

  const showResumeOption = useMemo(() => {
    if (!currentContent || currentContent.trim().length === 0) return false;
    if (hasErrorInContent || lastGenerationError) return true;
    
    if (depth === 'custom_analyzed') {
      let targetChapters: string[] = analysisResult?.chapters;
      if (!targetChapters || targetChapters.length === 0) {
        targetChapters = (localTopic as any)?.custom_analysis?.chapters || (localTopic as any)?.analysis_custom_analyzed?.chapters;
      }
      if (!targetChapters || targetChapters.length === 0) {
        targetChapters = getChaptersFromMonograph(currentContent);
      }

      if (targetChapters && targetChapters.length > 0) {
        const totalCh = targetChapters.length;
        let foundCount = 0;
        for (const ch of targetChapters) {
          const cleanCh = ch.replace(/^\d+\.\s*/, '').trim();
          if (currentContent.includes(`## ${ch}`) || (cleanCh && currentContent.includes(`## ${cleanCh}`))) {
            foundCount++;
          }
        }
        return foundCount < totalCh;
      }
    } else if (['monograph', 'master', 'elite'].includes(depth)) {
      const extracted = getChaptersFromMonograph(currentContent);
      if (extracted && extracted.length > 0) {
        let foundCount = 0;
        for (const ch of extracted) {
          const cleanCh = ch.replace(/^\d+\.\s*/, '').trim();
          if (currentContent.includes(`## ${ch}`) || (cleanCh && currentContent.includes(`## ${cleanCh}`))) {
            foundCount++;
          }
        }
        return foundCount < extracted.length;
      }
    }

    return false;
  }, [currentContent, hasErrorInContent, lastGenerationError, depth, analysisResult, localTopic]);

  const handleResumeAI = async () => {
    setLastGenerationError(null);

    if (depth === 'custom_analyzed') {
      let analysisToPass = analysisResult;
      if (!analysisToPass || !analysisToPass.chapters || analysisToPass.chapters.length === 0) {
        analysisToPass = (localTopic as any).analysis_custom_analyzed || (localTopic as any).custom_analysis;
      }
      if (!analysisToPass || !analysisToPass.chapters || analysisToPass.chapters.length === 0) {
        const extracted = getChaptersFromMonograph(currentContent);
        if (extracted.length > 0) {
          analysisToPass = {
            chapters: extracted,
            cost: extracted.length * 10,
            clinicalHighlights: [],
            justification: 'Capítulos preservados do sumário do documento.'
          };
        }
      }
      await handleGenerateCustomAnalyzedSummary(analysisToPass);
      return;
    }

    const costMap = {
      standard: 1,
      deep: 3,
      elite: 5,
      master: 10,
      monograph: 20
    };
    const requiredCredits = costMap[depth] || 1;
    if (!checkCreditsSufficient(requiredCredits)) {
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('Retomando de onde parou...');
    const subjectName = subjects.find(s => s.id === topic.subjectId)?.name || '';
    
    if (depth === 'monograph') {
      setMonographProgress({ current: 0, total: 11, message: 'Preparando retomada de elite...' });
    } else if (depth === 'master') {
      setMonographProgress({ current: 0, total: 4, message: 'Preparando retomada do preceptor...' });
    }

    try {
      const content = await resumeFailedSummaryContent(
        topic.title, 
        subjectName, 
        currentContent, 
        referencePref, 
        userId, 
        depth, 
        (prog) => {
          setMonographProgress(prog);
          setGenerationStatus(prog.message);
        }, 
        illustrationLevel, 
        alertBoxLevel,
        analysisResult
      );
      
      if (content) {
        const sanitized = sanitizeMarkdown(content);
        setCurrentContent(sanitized);
        
        const updateFields: any = {
          lastUpdated: new Date().toISOString()
        };
        if (depth === 'standard') {
          updateFields.content_standard = sanitized;
          updateFields.content = sanitized;
        } else if (depth === 'deep') {
          updateFields.content_deep = sanitized;
        } else if (depth === 'elite') {
          updateFields.content_elite = sanitized;
        } else if (depth === 'master') {
          updateFields.content_master = sanitized;
        } else if (depth === 'monograph') {
          updateFields.content_monograph = sanitized;
        } else if (depth === 'custom_analyzed') {
          updateFields.content_custom_analyzed = sanitized;
        }

        await updateDoc(getTopicDocRef(), updateFields);
        const updated = { ...topic, ...updateFields };
        setLocalTopic(updated);
        if (onTopicUpdate) {
          onTopicUpdate(updated);
        }
      }
    } catch (err: any) {
      console.error('Error during AI resume:', err);
      setLastGenerationError(err.message || 'Erro ao retomar geração');
      const errMsg = (err.message || "").toUpperCase();
      const isApiQuota = errMsg.includes('429') || errMsg.includes('QUOTA') || errMsg.includes('EXHAUSTED') || errMsg.includes('RATE_LIMIT');
      const isUserLimit = err.message?.includes('Limite diário de IA atingido') || 
                          err.message?.includes('Créditos insuficientes') || 
                          err.message?.includes('créditos insuficientes') || 
                          err.message?.includes('limite diário');
      
      if (isUserLimit) {
        setShowSubscriptionModal(true);
      } else if (isApiQuota) {
        alert('Limite temporário de requisições da API do Gemini atingido (máx 15 requisições por minuto no Tier Gratuito das chaves).\n\nSeus créditos do site continuam INTATOS!\n\nPor favor, aguarde de 30 a 60 segundos para liberar a API do Google e clique em Retomar novamente.');
      } else {
        alert('Erro ao retomar geração: ' + err.message);
      }
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
      setMonographProgress(null);
      await fetchQuota();
    }
  };

  const handleGenerateAI = async (overrideConfig?: any) => {
    const targetDepth = (overrideConfig?.depth || depth) as GenerationDepth;
    const targetIllLvl = overrideConfig?.illustrationLevel || illustrationLevel;
    const targetAlertLvl = overrideConfig?.alertBoxLevel || alertBoxLevel;
    const targetRef = overrideConfig?.referencePref || referencePref;

    const costMap = {
      standard: 1,
      deep: 5,
      elite: 10,
      master: 50,
      monograph: 100
    };
    const base = costMap[targetDepth as keyof typeof costMap] || 1;
    const requiredCredits = Math.max(1, base + calculateExtraCredits(targetIllLvl, targetAlertLvl));
    if (!checkCreditsSufficient(requiredCredits)) {
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('Iniciando...');
    const subjectName = subjects.find(s => s.id === topic.subjectId)?.name || '';
    
    if (targetDepth === 'monograph') {
      setMonographProgress({ current: 0, total: 11, message: 'Preparando motor de elite...' });
    } else if (targetDepth === 'master') {
      setMonographProgress({ current: 0, total: 4, message: 'Preparando preceptor médico...' });
    }

    try {
      const content = await generateTopicContent(topic.title, subjectName, targetRef, userId, targetDepth, (prog) => {
        setMonographProgress(prog);
        setGenerationStatus(prog.message);
        if (prog.partialContent) {
          setCurrentContent(sanitizeMarkdown(prog.partialContent));
        }
      }, targetIllLvl, targetAlertLvl);
      
      if (content) {
        const sanitized = sanitizeMarkdown(content);
        setCurrentContent(sanitized);
        
        // Save content specifically to corresponding depth property
        const updateFields: any = {
          lastUpdated: new Date().toISOString()
        };
        const fieldName = `content_${targetDepth}`;
        updateFields[fieldName] = sanitized;
        if (targetDepth === 'standard') {
          updateFields.content = sanitized; // Legacy support
        }

        // Update in Firestore
        await updateDoc(getTopicDocRef(), updateFields);
        const updated = { ...topic, ...updateFields };
        setLocalTopic(updated);
        setDepth(targetDepth);
        if (onTopicUpdate) {
          onTopicUpdate(updated);
        }
      }
    } catch (err: any) {
      console.error('Error during AI generation:', err);
      const errMsg = (err.message || "").toUpperCase();
      const isApiQuota = errMsg.includes('429') || errMsg.includes('QUOTA') || errMsg.includes('EXHAUSTED') || errMsg.includes('RATE_LIMIT');
      const isUserLimit = err.message?.includes('Limite diário de IA atingido') || 
                          err.message?.includes('Créditos insuficientes') || 
                          err.message?.includes('créditos insuficientes') || 
                          err.message?.includes('limite diário');
      
      if (isUserLimit) {
        setShowSubscriptionModal(true);
      } else if (isApiQuota) {
        alert('Limite temporário de requisições da API do Gemini atingido (máx 15 requisições por minuto no Tier Gratuito das chaves).\n\nSeus créditos do site continuam INTATOS e não foram consumidos!\n\nPor favor, aguarde de 1 a 2 minutos para liberar a API do Google e clique em Gerar novamente.');
      } else {
        alert('Erro ao gerar conteúdo: ' + err.message);
      }
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
      setMonographProgress(null);
      await fetchQuota(); // Refresh quota after generation
    }
  };

  const handleAddChapter = async () => {
    if (!newChapterName.trim()) return;
    const updated = [...editedChapters, newChapterName.trim()];
    setEditedChapters(updated);
    setNewChapterName('');
    if (analysisResult) {
      const newAnalysis = { ...analysisResult, chapters: updated };
      setAnalysisResult(newAnalysis);
      
      const updateFields: any = {
        [`analysis_${depth}`]: newAnalysis,
        lastUpdated: new Date().toISOString()
      };
      if (depth === 'custom_analyzed') {
        updateFields.custom_analysis = newAnalysis;
      }
      try {
        await updateDoc(getTopicDocRef(), updateFields);
        const updatedTopic = { ...localTopic, ...updateFields };
        setLocalTopic(updatedTopic);
        if (onTopicUpdate) {
          onTopicUpdate(updatedTopic);
        }
      } catch (err) {
        console.error('Error saving edited chapters:', err);
      }
    }
  };

  const handleRemoveChapter = async (indexToRemove: number) => {
    const updated = editedChapters.filter((_, idx) => idx !== indexToRemove);
    setEditedChapters(updated);
    if (analysisResult) {
      const newAnalysis = { ...analysisResult, chapters: updated };
      setAnalysisResult(newAnalysis);
      
      const updateFields: any = {
        [`analysis_${depth}`]: newAnalysis,
        lastUpdated: new Date().toISOString()
      };
      if (depth === 'custom_analyzed') {
        updateFields.custom_analysis = newAnalysis;
      }
      try {
        await updateDoc(getTopicDocRef(), updateFields);
        const updatedTopic = { ...localTopic, ...updateFields };
        setLocalTopic(updatedTopic);
        if (onTopicUpdate) {
          onTopicUpdate(updatedTopic);
        }
      } catch (err) {
        console.error('Error saving edited chapters:', err);
      }
    }
  };

  const handleRunAnalysis = async () => {
    const requiredCredits = getCalculatedCost();
    if (requiredCredits > 0 && !checkCreditsSufficient(requiredCredits)) {
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError('');
    const subjectName = subjects.find(s => s.id === topic.subjectId)?.name || '';
    try {
      const result = await analyzeSummaryNeeds(topic.title, subjectName, depth);
      setAnalysisResult(result);
      setEditedChapters(result.chapters || []);
      
      // Salva o resultado da análise no documento do tópico para persistência durável
      const updateFields: any = {
        [`analysis_${depth}`]: result,
        lastUpdated: new Date().toISOString()
      };
      if (depth === 'custom_analyzed') {
        updateFields.custom_analysis = result;
      }
      await updateDoc(getTopicDocRef(), updateFields);
      const updated = { ...topic, ...updateFields };
      setLocalTopic(updated);
      if (onTopicUpdate) {
        onTopicUpdate(updated);
      }
    } catch (err) {
      console.error('Error running pre-analysis:', err);
      setAnalysisError('Erro ao realizar a análise prévia. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getCalculatedCost = () => {
    let base = 10;
    if (depth === 'standard') base = 1;
    else if (depth === 'deep') base = 5;
    else if (depth === 'elite') base = 10;
    else if (depth === 'master') base = 50;
    else if (depth === 'monograph') base = 100;
    else {
      // Resumo Inteligente (custom_analyzed): cobrado estritamente por capítulo (10 créditos por capítulo)
      const chapterCount = editedChapters?.length || (analysisResult?.chapters?.length || 5);
      base = Math.max(10, chapterCount * 10);
    }

    const extra = calculateExtraCredits(illustrationLevel, alertBoxLevel);
    return Math.max(1, base + extra);
  };

  const handleGenerateCustomAnalyzedSummary = async (overrideAnalysis?: any, overrideConfig?: any) => {
    // Configurações a usar
    const targetDepth = overrideConfig?.depth || depth;
    const targetChapters = overrideConfig?.chapters || editedChapters;
    const targetIllLvl = overrideConfig?.illustrationLevel || illustrationLevel;
    const targetAlertLvl = overrideConfig?.alertBoxLevel || alertBoxLevel;

    let analysisToUse = overrideAnalysis || analysisResult;
    
    // Fallback se não houver análise prévia (ex: se o usuário optou por gerar "Sem Pré-Análise")
    if (!analysisToUse) {
      const subjectName = subjects.find(s => s.id === topic.subjectId)?.name || '';
      try {
        setGenerationStatus('Analisando tópicos e estruturando capítulos...');
        const autoAnalysis = await analyzeSummaryNeeds(topic.title, subjectName, targetDepth);
        if (autoAnalysis) {
          analysisToUse = autoAnalysis;
        } else {
          analysisToUse = {
            justification: 'Abordagem estruturada baseada no padrão de complexidade do tema.',
            chapters: targetChapters && targetChapters.length > 0 ? targetChapters : [
              'Introdução e Epidemiologia',
              'Fisiopatologia e Mecanismos',
              'Critérios Diagnósticos Oficiais',
              'Conduta Imediata e Tratamento Farmacológico',
              'Complicações e Armadilhas de Prova'
            ],
            clinicalHighlights: ['Diagnóstico e condutas de urgência']
          };
        }
      } catch (err) {
        console.error('Error generating auto analysis fallback:', err);
        analysisToUse = {
          justification: 'Abordagem estruturada baseada no padrão de complexidade do tema.',
          chapters: targetChapters && targetChapters.length > 0 ? targetChapters : [
            'Introdução e Epidemiologia',
            'Fisiopatologia e Mecanismos',
            'Critérios Diagnósticos Oficiais',
            'Conduta Imediata e Tratamento Farmacológico',
            'Complicações e Armadilhas de Prova'
          ],
          clinicalHighlights: ['Diagnóstico e condutas de urgência']
        };
      }
    }

    // Calcular custo usando os parâmetros target
    let baseCost = 25;
    if (targetDepth === 'standard') baseCost = 1;
    else if (targetDepth === 'deep') baseCost = 5;
    else if (targetDepth === 'elite') baseCost = 10;
    else if (targetDepth === 'master') baseCost = 50;
    else if (targetDepth === 'monograph') baseCost = 100;
    else {
      const chapterCount = targetChapters?.length || (analysisToUse?.chapters?.length || 5);
      baseCost = Math.max(10, chapterCount * 10);
    }
    const extraCost = calculateExtraCredits(targetIllLvl, targetAlertLvl);
    const requiredCredits = Math.max(1, baseCost + extraCost);
    
    if (!checkCreditsSufficient(requiredCredits)) {
      return;
    }

    setIsGenerating(true);
    setLastGenerationError(null);
    setGenerationStatus('Iniciando...');
    setMonographProgress({ current: 0, total: analysisToUse.chapters.length, message: 'Preparando preceptor médico personalizado...' });
    const subjectName = subjects.find(s => s.id === topic.subjectId)?.name || '';

    const fieldName = `content_${targetDepth}`;
    const existingContent = localTopic[fieldName as keyof typeof localTopic] || '';

    try {
      const content = await generateCustomAnalyzedSummary(
        topic.title,
        subjectName,
        analysisToUse,
        overrideConfig?.referencePref || referencePref,
        userId,
        async (prog) => {
          setMonographProgress(prog);
          setGenerationStatus(prog.message);
          
          if (prog.partialContent) {
            const sanitized = sanitizeMarkdown(prog.partialContent);
            setCurrentContent(sanitized);

            const updateFields: any = {
              [fieldName]: sanitized,
              custom_analysis: analysisToUse,
              [`analysis_${targetDepth}`]: analysisToUse,
              lastUpdated: new Date().toISOString()
            };
            if (targetDepth === 'standard') {
              updateFields.content = sanitized;
            }

            try {
              await updateDoc(getTopicDocRef(), updateFields);
              const updated = { ...topic, ...updateFields };
              setLocalTopic(updated);
              setAnalysisResult(analysisToUse);
              if (analysisToUse?.chapters) setEditedChapters(analysisToUse.chapters);
              if (onTopicUpdate) {
                onTopicUpdate(updated);
              }
            } catch (fsErr) {
              console.error('Error saving incremental chapter to Firestore:', fsErr);
            }
          }
        },
        targetIllLvl,
        targetAlertLvl,
        existingContent as string,
        targetDepth
      );

      if (content) {
        const sanitized = sanitizeMarkdown(content);
        setCurrentContent(sanitized);

        const updateFields: any = {
          [fieldName]: sanitized,
          custom_analysis: analysisToUse,
          [`analysis_${targetDepth}`]: analysisToUse,
          lastUpdated: new Date().toISOString()
        };
        if (targetDepth === 'standard') {
          updateFields.content = sanitized;
        }

        await updateDoc(getTopicDocRef(), updateFields);
        const updated = { ...topic, ...updateFields };
        setLocalTopic(updated);
        setDepth(depth);
        setAnalysisResult(analysisToUse);
        if (analysisToUse?.chapters) setEditedChapters(analysisToUse.chapters);
        if (onTopicUpdate) {
          onTopicUpdate(updated);
        }
      }
    } catch (err: any) {
      console.error('Error generating custom summary:', err);
      setLastGenerationError(err.message || 'Erro na geração de conteúdo');
      const errMsg = (err.message || "").toUpperCase();
      const isApiQuota = errMsg.includes('429') || errMsg.includes('QUOTA') || errMsg.includes('EXHAUSTED') || errMsg.includes('RATE_LIMIT');
      const isUserLimit = err.message?.includes('Limite diário de IA atingido') || 
                          err.message?.includes('Créditos insuficientes') || 
                          err.message?.includes('créditos insuficientes') || 
                          err.message?.includes('limite diário');
      
      if (isUserLimit) {
        setShowSubscriptionModal(true);
      } else if (isApiQuota) {
        alert('Limite temporário de requisições da API do Gemini atingido (máx 15 requisições por minuto no Tier Gratuito das chaves).\n\nSeus créditos do site continuam INTATOS e não foram consumidos!\n\nPor favor, aguarde de 1 a 2 minutos para liberar a API do Google e clique em Gerar novamente.');
      } else {
        alert('Erro ao gerar o conteúdo personalizado: ' + err.message);
      }
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
      setMonographProgress(null);
      await fetchQuota();
    }
  };

  const handleSaveManualContent = async () => {
    try {
      const sanitized = sanitizeMarkdown(editedContent);
      setCurrentContent(sanitized);
      
      const updateFields: any = {
        lastUpdated: new Date().toISOString()
      };
      if (depth === 'standard') {
        updateFields.content_standard = sanitized;
        updateFields.content = sanitized; // Legacy support
      } else if (depth === 'deep') {
        updateFields.content_deep = sanitized;
      } else if (depth === 'elite') {
        updateFields.content_elite = sanitized;
      } else if (depth === 'master') {
        updateFields.content_master = sanitized;
      } else if (depth === 'monograph') {
        updateFields.content_monograph = sanitized;
      } else if (depth === 'custom_analyzed') {
        updateFields.content_custom_analyzed = sanitized;
      }

      await updateDoc(getTopicDocRef(), updateFields);
      const updated = { ...topic, ...updateFields };
      setLocalTopic(updated);
      if (onTopicUpdate) {
        onTopicUpdate(updated);
      }
      setIsEditingContent(false);
    } catch (error) {
      console.error('Error saving manual summary:', error);
      alert('Erro ao salvar o resumo.');
    }
  };

  const handleDeleteSummary = async () => {
    if (window.confirm("Deseja realmente apagar e resetar o resumo teórico deste tópico? Todo o conteúdo deste resumo será apagado para que você possa refazê-lo do zero.")) {
      try {
        const updateFields: any = {
          lastUpdated: new Date().toISOString()
        };
        
        if (depth === 'standard') {
          updateFields.content_standard = '';
          updateFields.content = '';
        } else if (depth === 'deep') {
          updateFields.content_deep = '';
        } else if (depth === 'elite') {
          updateFields.content_elite = '';
        } else if (depth === 'master') {
          updateFields.content_master = '';
        } else if (depth === 'monograph') {
          updateFields.content_monograph = '';
        } else if (depth === 'custom_analyzed') {
          updateFields.content_custom_analyzed = '';
        } else {
          updateFields.content_standard = '';
          updateFields.content_deep = '';
          updateFields.content_elite = '';
          updateFields.content_master = '';
          updateFields.content_monograph = '';
          updateFields.content_custom_analyzed = '';
          updateFields.content = '';
        }

        safeLocalStorageRemove(`offline_summary_${topic.id}_${depth}`);
        safeLocalStorageRemove(`offline_summary_${topic.id}`);

        await updateDoc(getTopicDocRef(), updateFields);
        const updated = { ...topic, ...updateFields };
        setLocalTopic(updated);
        setCurrentContent('');
        if (onTopicUpdate) {
          onTopicUpdate(updated);
        }
        alert('Resumo excluído com sucesso! Agora você pode criar um novo resumo do zero.');
      } catch (error: any) {
        console.error('Erro ao apagar resumo:', error);
        alert('Erro ao apagar resumo: ' + (error?.message || error));
      }
    }
  };

  const handleDeepen = async (section: string, custom?: string) => {
    const requiredCredits = custom ? 4 : 2;
    if (!checkCreditsSufficient(requiredCredits)) {
      return;
    }
    setIsDeepening(true);
    try {
      const expandedText = await deepenTopicSection(topic.title, currentContent, section, userId, custom);
      if (expandedText) {
        const title = custom ? `Dúvida Específica: ${custom}` : section;
        const uuid = Math.random().toString(36).substr(2, 9);
        const targetId = `deepening-${uuid}`;
        
        const deepeningBlock = `\n\n---\n\n<div id="${targetId}" class="p-6 my-6 bg-purple-50/40 border-l-4 border-purple-500 rounded-r-2xl shadow-sm leading-relaxed select-text font-serif">\n\n### 🧬 Aprofundamento: ${title}\n\n${expandedText}\n\n</div>`;
        const newContent = `${currentContent}${deepeningBlock}`;
        setCurrentContent(newContent);
        
        const updateFields: any = {
          lastUpdated: new Date().toISOString()
        };
        if (depth === 'standard') {
          updateFields.content_standard = newContent;
          updateFields.content = newContent;
        } else if (depth === 'deep') {
          updateFields.content_deep = newContent;
        } else if (depth === 'elite') {
          updateFields.content_elite = newContent;
        } else if (depth === 'master') {
          updateFields.content_master = newContent;
        } else if (depth === 'monograph') {
          updateFields.content_monograph = newContent;
        } else if (depth === 'custom_analyzed') {
          updateFields.content_custom_analyzed = newContent;
        }

        await updateDoc(getTopicDocRef(), updateFields);
        const updated = { ...topic, ...updateFields };
        setLocalTopic(updated);
        if (onTopicUpdate) {
          onTopicUpdate(updated);
        }
        if (custom) setCustomDeepenText('');
      }
    } catch (error) {
      console.error('Error deepening section:', error);
    }
    setIsDeepening(false);
  };

  const downloadMarkdown = () => {
    const cleanTitle = sanitizeTitle(topic.title);
    const filename = `Resumo_${cleanTitle || 'Elite'}.md`;
    const blob = new Blob([currentContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadHTML = () => {
    const cleanTitle = sanitizeTitle(topic.title);
    const filename = `Resumo_${cleanTitle || 'Elite'}.html`;
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${topic.title}</title>
<style>
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.7;
  padding: 40px;
  max-width: 900px;
  margin: 0 auto;
  color: #2D3748;
  background: #F7FAFC;
}
.container {
  background: #ffffff;
  padding: 50px 60px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid #E2E8F0;
}
h1 {
  color: #1A202C;
  font-size: 32px;
  font-weight: 800;
  border-bottom: 2px solid #E2E8F0;
  padding-bottom: 16px;
  margin-bottom: 24px;
  letter-spacing: -0.025em;
}
h2 {
  color: #2D3748;
  font-size: 22px;
  font-weight: 700;
  margin-top: 36px;
  margin-bottom: 16px;
  border-bottom: 1px solid #EDF2F7;
  padding-bottom: 8px;
  letter-spacing: -0.021em;
}
h3 {
  color: #4A5568;
  font-size: 18px;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 12px;
}
p {
  margin-top: 0;
  margin-bottom: 16px;
  color: #4A5568;
  font-size: 15px;
}
ul, ol {
  margin-top: 0;
  margin-bottom: 16px;
  padding-left: 24px;
}
li {
  margin-bottom: 8px;
  color: #4A5568;
  font-size: 15px;
}
blockquote {
  border-left: 4px solid #3182CE;
  margin: 20px 0;
  padding: 16px 20px;
  background: #EBF8FF;
  border-radius: 8px;
}
blockquote.note { border-left-color: #3182CE; background: #EBF8FF; }
blockquote.tip { border-left-color: #38A169; background: #F0FFF4; }
blockquote.important { border-left-color: #DD6B20; background: #FFFAF0; }
blockquote.caution { border-left-color: #E53E3E; background: #FFF5F5; }
blockquote.clinical_case { border-left-color: #805AD5; background: #FAF5FF; }
blockquote.checklist { border-left-color: #5A67D8; background: #EBF4FF; }
blockquote.summary { border-left-color: #E53E3E; background: #FFF5F5; }
blockquote.flowchart { border-left-color: #319795; background: #E6FFFA; }

table {
  border-collapse: collapse;
  width: 100%;
  margin: 24px 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #E2E8F0;
}
th, td {
  padding: 12px 16px;
  text-align: left;
  font-size: 14px;
}
th {
  background: #EDF2F7;
  color: #2D3748;
  font-weight: 700;
  border-bottom: 2px solid #E2E8F0;
}
td {
  border-bottom: 1px solid #EDF2F7;
  color: #4A5568;
}
tr:last-child td {
  border-bottom: none;
}
tr:nth-child(even) {
  background: #F7FAFC;
}
code {
  font-family: SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
  background: #EDF2F7;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 85%;
  color: #805AD5;
}
pre {
  background: #1A202C;
  color: #F7FAFC;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 20px 0;
}
pre code {
  background: transparent;
  padding: 0;
  color: inherit;
  font-size: 14px;
}
strong {
  color: #1A202C;
  font-weight: 700;
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}
.badge-note { background: #EBF8FF; color: #2B6CB0; }
.badge-tip { background: #F0FFF4; color: #2F855A; }
.badge-important { background: #FFFAF0; color: #C05621; }
.badge-caution { background: #FFF5F5; color: #C53030; }
.badge-clinical_case { background: #FAF5FF; color: #6B46C1; }
.badge-checklist { background: #EBF4FF; color: #4C51BF; }
.badge-summary { background: #FFF5F5; color: #C53030; }
.badge-flowchart { background: #E6FFFA; color: #2C7A7B; }

/* Custom watermark styling */
.watermark-footer {
  margin-top: 50px;
  padding-top: 30px;
  border-top: 2px dashed #E2E8F0;
  text-align: center;
}
.watermark-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 10px;
}
.watermark-logo .logo-icon {
  font-size: 22px;
}
.watermark-logo .logo-text {
  font-size: 18px;
  font-weight: 800;
  color: #1A202C;
  letter-spacing: -0.02em;
}
.watermark-footer p {
  font-size: 13px;
  color: #718096;
  max-width: 480px;
  margin: 0 auto 16px auto;
  line-height: 1.5;
}
.watermark-btn {
  display: inline-block;
  background: #D44E3D;
  color: #ffffff !important;
  font-weight: 700;
  text-decoration: none;
  font-size: 12px;
  padding: 8px 20px;
  border-radius: 9999px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 6px -1px rgba(212, 78, 61, 0.15);
}
.watermark-btn:hover {
  background: #b83d2e;
  transform: translateY(-1px);
}
.watermark-badge {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid #E2E8F0;
  padding: 6px 14px;
  border-radius: 9999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-decoration: none;
  z-index: 99999;
  transition: all 0.2s ease;
}
.watermark-badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  border-color: #CBD5E1;
  background: #ffffff;
}
.watermark-badge span {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #718096;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 2px;
}
.watermark-badge strong {
  font-size: 12px;
  color: #D44E3D;
  font-weight: 800;
  line-height: 1;
}
@media print {
  .watermark-badge {
    display: none !important;
  }
}
</style>
</head>
<body>
<div class="container">
<h1>${topic.title}</h1>
<div>${convertMarkdownToHtml(currentContent)}</div>

<!-- Marca d'água no final do documento -->
<div class="watermark-footer">
  <div class="watermark-logo">
    <span class="logo-icon">🎓</span>
    <span class="logo-text">MedRevise</span>
  </div>
  <p>Este resumo inteligente foi gerado através do <strong>MedRevise</strong>, a plataforma de estudos definitiva para o Internato e Residência Médica.</p>
  <a href="https://medrevise.com.br" target="_blank" class="watermark-btn">Acessar medrevise.com.br</a>
</div>
</div>

<!-- Marca d'água flutuante no canto da tela -->
<a href="https://medrevise.com.br" target="_blank" class="watermark-badge">
  <span>Gerado por</span>
  <strong>MedRevise.com.br</strong>
</a>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showOfflineToast("Resumo em HTML baixado com sucesso!");
  };

  const downloadPDF = async () => {
    if (topic.importedPdfData) {
      try {
        setIsGeneratingPDF(true);
        const cleanTitle = sanitizeTitle(topic.title);
        const filename = topic.importedPdfName || `Documento_${cleanTitle || 'Elite'}.pdf`;
        const link = document.createElement('a');
        link.href = topic.importedPdfData;
        link.download = filename;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('Error downloading attached file:', err);
      } finally {
        setIsGeneratingPDF(false);
      }
      return;
    }

    if (!pdfRef.current) return;
    
    setIsGeneratingPDF(true);
    const cleanTitle = sanitizeTitle(topic.title);
    const filename = `Resumo_${cleanTitle || 'Elite'}.pdf`;
    setPdfFilename(filename);

    const originalGetComputedStyle = window.getComputedStyle;
    const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
    
    const colorProps = [
      'color', 'background', 'backgroundColor', 'borderColor', 
      'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
      'outlineColor', 'textDecorationColor', 'fill', 'stroke'
    ];
    
    const originalDescriptors: Record<string, PropertyDescriptor | undefined> = {};
    const styleBackups = new Map<HTMLStyleElement, string>();

    try {
      // 1. Backup `<style>` tags text content and translate OKLCH colors to standard RGB colors
      try {
        const styleTags = Array.from(document.querySelectorAll('style'));
        for (const tag of styleTags) {
          if (tag.textContent && tag.textContent.includes('oklch')) {
            styleBackups.set(tag, tag.textContent);
            tag.textContent = tag.textContent.replace(/oklch\([^)]+\)/g, (match) => convertOklchToRgb(match));
          }
        }
      } catch (styleErr) {
        console.warn('Could not translate oklch style tags:', styleErr);
      }

      // 2. Patch CSSStyleDeclaration.prototype.getPropertyValue to support stylesheet and rule reading safely
      try {
        CSSStyleDeclaration.prototype.getPropertyValue = function(this: CSSStyleDeclaration, property: string) {
          const value = originalGetPropertyValue.call(this, property);
          if (typeof value === 'string' && value.includes('oklch')) {
            return value.replace(/oklch\([^)]+\)/g, (match) => convertOklchToRgb(match));
          }
          return value;
        };
      } catch (getPropertyErr) {
        console.warn('Could not patch CSSStyleDeclaration.prototype.getPropertyValue:', getPropertyErr);
      }

      // 3. Patch specific color properties on CSSStyleDeclaration.prototype safely
      for (const prop of colorProps) {
        try {
          const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, prop);
          originalDescriptors[prop] = desc;
          
          Object.defineProperty(CSSStyleDeclaration.prototype, prop, {
            get() {
              const value = desc && desc.get ? desc.get.call(this) : originalGetPropertyValue.call(this, prop);
              if (typeof value === 'string' && value.includes('oklch')) {
                return value.replace(/oklch\([^)]+\)/g, (match) => convertOklchToRgb(match));
              }
              return value;
            },
            set(val) {
              if (desc && desc.set) {
                desc.set.call(this, val);
              } else {
                this.setProperty(prop, val);
              }
            },
            configurable: true,
            enumerable: desc ? desc.enumerable : true
          });
        } catch (colorPropErr) {
          console.warn(`Could not patch CSSStyleDeclaration prototype property: ${prop}`, colorPropErr);
        }
      }

      // 4. Patch `cssText` on CSS descriptors safely to parse cleanly in html2canvas rule scanner
      try {
        const descStyleCssText = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText');
        if (descStyleCssText) {
          originalDescriptors['CSSStyleDeclaration_cssText'] = descStyleCssText;
          Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', {
            get() {
              const value = descStyleCssText.get ? descStyleCssText.get.call(this) : '';
              if (typeof value === 'string' && value.includes('oklch')) {
                return value.replace(/oklch\([^)]+\)/g, (match) => convertOklchToRgb(match));
              }
              return value;
            },
            set(val) {
              if (descStyleCssText.set) {
                descStyleCssText.set.call(this, val);
              }
            },
            configurable: true,
            enumerable: descStyleCssText.enumerable
          });
        }
      } catch (cssTextErr) {
        console.warn('Could not patch CSSStyleDeclaration cssText descriptor:', cssTextErr);
      }

      try {
        const descRuleCssText = Object.getOwnPropertyDescriptor(CSSRule.prototype, 'cssText');
        if (descRuleCssText) {
          originalDescriptors['CSSRule_cssText'] = descRuleCssText;
          Object.defineProperty(CSSRule.prototype, 'cssText', {
            get() {
              const value = descRuleCssText.get ? descRuleCssText.get.call(this) : '';
              if (typeof value === 'string' && value.includes('oklch')) {
                return value.replace(/oklch\([^)]+\)/g, (match) => convertOklchToRgb(match));
              }
              return value;
            },
            set(val) {
              if (descRuleCssText.set) {
                descRuleCssText.set.call(this, val);
              }
            },
            configurable: true,
            enumerable: descRuleCssText.enumerable
          });
        }
      } catch (ruleCssTextErr) {
        console.warn('Could not patch CSSRule cssText descriptor:', ruleCssTextErr);
      }

      try {
        if (typeof CSSStyleRule !== 'undefined') {
          const descStyleRuleCssText = Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'cssText');
          if (descStyleRuleCssText) {
            originalDescriptors['CSSStyleRule_cssText'] = descStyleRuleCssText;
            Object.defineProperty(CSSStyleRule.prototype, 'cssText', {
              get() {
                const value = descStyleRuleCssText.get ? descStyleRuleCssText.get.call(this) : '';
                if (typeof value === 'string' && value.includes('oklch')) {
                  return value.replace(/oklch\([^)]+\)/g, (match) => convertOklchToRgb(match));
                }
                return value;
              },
              set(val) {
                if (descStyleRuleCssText.set) {
                  descStyleRuleCssText.set.call(this, val);
                }
              },
              configurable: true,
              enumerable: descStyleRuleCssText.enumerable
            });
          }
        }
      } catch (styleRuleCssTextErr) {
        console.warn('Could not patch CSSStyleRule cssText descriptor:', styleRuleCssTextErr);
      }

      // 5. Override window.getComputedStyle safely to return standard RGB colors instead of unsupported OKLCH
      try {
        window.getComputedStyle = function(elt: Element, pseudoElt?: string | null) {
          const style = originalGetComputedStyle(elt, pseudoElt);
          return new Proxy(style, {
            get(target, prop) {
              if (prop === 'getPropertyValue') {
                return function(propertyName: string) {
                  const value = target.getPropertyValue(propertyName);
                  if (typeof value === 'string' && value.includes('oklch')) {
                    return value.replace(/oklch\([^)]+\)/g, (match) => convertOklchToRgb(match));
                  }
                  return value;
                };
              }
              
              const val = Reflect.get(target, prop);
              if (typeof val === 'string' && val.includes('oklch')) {
                return val.replace(/oklch\([^)]+\)/g, (match) => convertOklchToRgb(match));
              }
              if (typeof val === 'function') {
                return val.bind(target);
              }
              return val;
            }
          });
        };
      } catch (getComputedStyleErr) {
        console.warn('Could not patch window.getComputedStyle with Proxy:', getComputedStyleErr);
      }

      const element = pdfRef.current;
      if (!element) return;
      
      // Create a standard, custom-styled detached container for html2canvas
      const renderContainer = document.createElement('div');
      renderContainer.style.position = 'absolute';
      renderContainer.style.left = '-9999px';
      renderContainer.style.top = '0';
      renderContainer.style.width = '850px'; // Pre-optimized screen width for standard layouts
      renderContainer.style.backgroundColor = '#ffffff';
      renderContainer.style.padding = '40px';
      renderContainer.style.boxSizing = 'border-box';
      renderContainer.className = 'pdf-export-reset markdown-body prose prose-slate max-w-none';

      // Clone and append the entire element
      const clonedElement = element.cloneNode(true) as HTMLElement;
      // Remove shadows, border margins to keep it extremely clean and precise
      clonedElement.style.margin = '0';
      clonedElement.style.padding = '0';
      clonedElement.style.boxShadow = 'none';
      clonedElement.style.border = 'none';
      clonedElement.style.width = '100%';
      clonedElement.style.display = 'block';
      
      renderContainer.appendChild(clonedElement);
      document.body.appendChild(renderContainer);

      // Render the entire document to a high-resolution canvas
      const fullCanvas = await html2canvas(renderContainer, {
        scale: 2.0, // High-quality display scale
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      document.body.removeChild(renderContainer);

      // Slicing calculations
      const canvasWidth = fullCanvas.width;
      const canvasHeight = fullCanvas.height;
      
      // A4 portrait paper is approximately 1 : 1.4142 in aspect ratio
      const canvasPageHeight = Math.floor(canvasWidth * 1.4142);
      const totalPages = Math.ceil(canvasHeight / canvasPageHeight);
      
      // Create a standard A4 portrait PDF (points)
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4'
      });
      const imgWidth = 595.28;  // A4 width in pt
      const imgHeight = 841.89; // A4 height in pt

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        // Create standard canvas slice
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvasWidth;
        sliceCanvas.height = canvasPageHeight;

        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          // Fill background with clean white for margins or empty space at bottom
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasWidth, canvasPageHeight);

          const sourceY = i * canvasPageHeight;
          const remainingHeight = canvasHeight - sourceY;
          const currentSliceHeight = Math.min(canvasPageHeight, remainingHeight);

          ctx.drawImage(
            fullCanvas,
            0, sourceY, canvasWidth, currentSliceHeight, // Source coordinates
            0, 0, canvasWidth, currentSliceHeight         // Destination coordinates
          );
        }

        const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      }

      // Output to standard Blob for Maximum ecosystem support
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPdfDownloadUrl(blobUrl);

      try {
        // Try native jsPDF file save trigger first
        pdf.save(filename);
      } catch (saveError) {
        console.warn('Native pdf.save failed, trying custom anchor download:', saveError);
        // Fallback: Trigger download via standard anchor link click (runs in sandboxed dynamic links)
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.target = "_blank"; // sandbox restriction helper
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Canvas PDF export error, generating direct vector PDF fallback:', error);
      try {
        const fallbackPdf = new jsPDF({
          orientation: 'p',
          unit: 'pt',
          format: 'a4'
        });
        
        fallbackPdf.setFont('helvetica', 'normal');
        fallbackPdf.setFontSize(10);
        
        const cleanTitle = sanitizeTitle(topic.title);
        const fallbackFilename = `Resumo_${cleanTitle || 'Elite'}.pdf`;
        setPdfFilename(fallbackFilename);
        
        const rawLines = currentContent.split('\n');
        let y = 50;
        const margin = 50;
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const maxLineWidth = pageWidth - (margin * 2);
        
        // Add Title
        fallbackPdf.setFont('helvetica', 'bold');
        fallbackPdf.setFontSize(18);
        fallbackPdf.setTextColor(139, 0, 0); // Crimson color
        const titleLines = fallbackPdf.splitTextToSize(topic.title || 'Resumo', maxLineWidth);
        titleLines.forEach((tLine: string) => {
          if (y > pageHeight - margin) {
            fallbackPdf.addPage();
            y = margin;
          }
          fallbackPdf.text(tLine, margin, y);
          y += 24;
        });
        y += 10;
        
        fallbackPdf.setFont('helvetica', 'normal');
        fallbackPdf.setFontSize(10);
        fallbackPdf.setTextColor(44, 43, 41);
        
        for (const line of rawLines) {
          const trimmed = line.trim();
          if (!trimmed) {
            y += 10;
            continue;
          }
          
          let fontSize = 10;
          let isBold = false;
          let color = [44, 43, 41];
          let currentLineText = trimmed;
          
          if (trimmed.startsWith('### ')) {
            fontSize = 11;
            isBold = true;
            color = [74, 85, 104];
            currentLineText = trimmed.substring(4);
            y += 8;
          } else if (trimmed.startsWith('## ')) {
            fontSize = 13;
            isBold = true;
            color = [45, 55, 72];
            currentLineText = trimmed.substring(3);
            y += 14;
          } else if (trimmed.startsWith('# ')) {
            fontSize = 15;
            isBold = true;
            color = [26, 32, 44];
            currentLineText = trimmed.substring(2);
            y += 16;
          } else if (trimmed.startsWith('> ')) {
            isBold = true;
            color = [139, 0, 0];
            currentLineText = trimmed.substring(2);
          }
          
          // Strip basic md markers to keep native fallback clean
          currentLineText = currentLineText.replace(/\*\*([^*]+)\*\*/g, '$1');
          currentLineText = currentLineText.replace(/\*([^*]+)\*/g, '$1');
          currentLineText = currentLineText.replace(/`([^`]+)`/g, '$1');
          
          fallbackPdf.setFont('helvetica', isBold ? 'bold' : 'normal');
          fallbackPdf.setFontSize(fontSize);
          fallbackPdf.setTextColor(color[0], color[1], color[2]);
          
          const wrappedLines = fallbackPdf.splitTextToSize(currentLineText, maxLineWidth);
          for (const wLine of wrappedLines) {
            if (y > pageHeight - margin) {
              fallbackPdf.addPage();
              y = margin;
            }
            fallbackPdf.text(wLine, margin, y);
            y += fontSize + 4;
          }
        }
        
        const pdfBlob = fallbackPdf.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        setPdfDownloadUrl(blobUrl);
        
        try {
          fallbackPdf.save(fallbackFilename);
        } catch (saveError) {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fallbackFilename;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (pdfErr) {
        console.error('Vector PDF fallback failed, exporting beautiful HTML as last resort:', pdfErr);
        const cleanTitle = sanitizeTitle(topic.title);
        const fallbackHtmlFilename = `Resumo_${cleanTitle || 'Elite'}.html`;
        setPdfFilename(fallbackHtmlFilename);
        
        const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${topic.title}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; padding: 40px; max-width: 850px; margin: 0 auto; color: #1a1a1a; background: #fff; }
h1 { color: #8B0000; font-size: 28px; border-bottom: 2px solid #E2E0D9; padding-bottom: 12px; margin-bottom: 20px; }
h2 { color: #1a1a1a; font-size: 20px; border-bottom: 1px solid #E2E0D9; padding-bottom: 8px; margin-top: 32px; }
h3 { color: #2C2B29; font-size: 16px; margin-top: 24px; }
p, li { font-size: 15px; color: #2C2B29; }
blockquote { border-left: 4px solid #D44E3D; margin: 20px 0; padding: 12px 18px; background: #FFF5F4; border-radius: 8px; }
table { border-collapse: collapse; width: 100%; margin: 20px 0; }
th, td { border: 1px solid #E2E0D9; padding: 12px; text-align: left; font-size: 14px; }
th { background: #F8F7F4; font-weight: bold; }
</style>
</head>
<body>
<h1>${topic.title}</h1>
<div>${convertMarkdownToHtml(currentContent)}</div>
</body>
</html>`;
        const fallbackBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const fallbackUrl = URL.createObjectURL(fallbackBlob);
        setPdfDownloadUrl(fallbackUrl);
        
        const link = document.createElement('a');
        link.href = fallbackUrl;
        link.download = fallbackHtmlFilename;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      
      try {
        CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
      } catch (restoreErr) {
        console.warn('Could not restore CSSStyleDeclaration.prototype.getPropertyValue:', restoreErr);
      }
      
      // Restore CSS prototype descriptors safely
      for (const prop of colorProps) {
        const desc = originalDescriptors[prop];
        if (desc !== undefined) {
          try {
            Object.defineProperty(CSSStyleDeclaration.prototype, prop, desc);
          } catch (e) {
            console.warn(`Could not restore original descriptor for property ${prop}`, e);
          }
        }
      }

      const otherDescriptors = [
        { proto: CSSStyleDeclaration.prototype, key: 'cssText', name: 'CSSStyleDeclaration_cssText' },
        { proto: CSSRule.prototype, key: 'cssText', name: 'CSSRule_cssText' },
        ...(typeof CSSStyleRule !== 'undefined' ? [{ proto: CSSStyleRule.prototype, key: 'cssText', name: 'CSSStyleRule_cssText' }] : [])
      ];

      for (const item of otherDescriptors) {
        const desc = originalDescriptors[item.name];
        if (desc) {
          try {
            Object.defineProperty(item.proto, item.key, desc);
          } catch (e) {
            console.warn(`Could not restore original descriptor for ${item.key} on ${item.name}`, e);
          }
        }
      }

      // Restore `<style>` tags contents
      for (const [tag, originalText] of styleBackups.entries()) {
        try {
          tag.textContent = originalText;
        } catch (e) {
          console.warn('Could not restore style tag content', e);
        }
      }
      
      setIsGeneratingPDF(false);
    }
  };

  const handleImportPDF = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*,.txt,.md,.doc,.docx';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) {
        if (input.parentNode) document.body.removeChild(input);
        return;
      }

      if (input.parentNode) document.body.removeChild(input);

      const isText = file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md');

      const useAI = confirm(
        `Como deseja importar o arquivo "${file.name}"?\n\n` +
        `-> Pressione [OK] para Processar com IA (o preceptor lerá o documento e gerará um resumo médico em Markdown estruturado - consome 5 créditos).\n` +
        `-> Pressione [CANCELAR] para Importação/Visualização Direta (salva o conteúdo/arquivo original sem consumir créditos).`
      );

      if (useAI) {
        if (!checkCreditsSufficient(5)) {
          return;
        }
      }

      setIsImporting(true);

      try {
        if (isText) {
          const textContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Erro ao ler o arquivo de texto.'));
            reader.readAsText(file);
          });

          if (useAI) {
            const resultMarkdown = await importPdfWithAI(textContent, 'text/plain', file.name, 5);
            if (!resultMarkdown) throw new Error('O processador da IA retornou um conteúdo vazio.');
            
            setCurrentContent(resultMarkdown);
            const updateFields: any = { lastUpdated: new Date().toISOString() };
            if (depth === 'standard') updateFields.content_standard = updateFields.content = resultMarkdown;
            else if (depth === 'deep') updateFields.content_deep = resultMarkdown;
            else if (depth === 'elite') updateFields.content_elite = resultMarkdown;
            else if (depth === 'master') updateFields.content_master = resultMarkdown;
            else if (depth === 'monograph') updateFields.content_monograph = resultMarkdown;

            await updateDoc(getTopicDocRef(), updateFields);
            const updatedTopic = { ...topic, ...updateFields };
            setLocalTopic(updatedTopic);
            if (onTopicUpdate) onTopicUpdate(updatedTopic);
            alert('Parabéns! O arquivo de texto foi processado pela IA e salvo com sucesso.');
          } else {
            setCurrentContent(textContent);
            const updateFields: any = { content: textContent, content_standard: textContent, lastUpdated: new Date().toISOString() };
            await updateDoc(getTopicDocRef(), updateFields);
            const updatedTopic = { ...topic, ...updateFields };
            setLocalTopic(updatedTopic);
            if (onTopicUpdate) onTopicUpdate(updatedTopic);
            alert('Parabéns! O arquivo de texto foi importado e salvo com sucesso.');
          }
        } else {
          // PDF or Image
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Erro ao carregar o arquivo.'));
            reader.readAsDataURL(file);
          });

          if (useAI) {
            const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            const resultMarkdown = await importPdfWithAI(base64Data, file.type || 'application/pdf', file.name, 5);
            if (!resultMarkdown) throw new Error('O processador de documentos da IA retornou um conteúdo vazio.');

            setCurrentContent(resultMarkdown);
            const updateFields: any = { lastUpdated: new Date().toISOString() };
            if (depth === 'standard') updateFields.content_standard = updateFields.content = resultMarkdown;
            else if (depth === 'deep') updateFields.content_deep = resultMarkdown;
            else if (depth === 'elite') updateFields.content_elite = resultMarkdown;
            else if (depth === 'master') updateFields.content_master = resultMarkdown;
            else if (depth === 'monograph') updateFields.content_monograph = resultMarkdown;

            await updateDoc(getTopicDocRef(), updateFields);
            const updatedTopic = { ...topic, ...updateFields };
            setLocalTopic(updatedTopic);
            if (onTopicUpdate) onTopicUpdate(updatedTopic);
            alert('Parabéns! Documento processado pela IA e salvo como resumo com sucesso.');
          } else {
            if (dataUrl.length > 1024 * 1024 * 1.5) {
              alert('Atenção: O arquivo excede o limite de tamanho para anexo local. Tente um PDF ou imagem menor.');
              setIsImporting(false);
              return;
            }

            const markdownPlaceholder = `# DOCUMENTO ANEXO: ${file.name}\n\nEste tópico possui um documento original anexado, disposto exatamente para o seu estudo.`;
            setCurrentContent(markdownPlaceholder);

            const updateFields = {
              content: markdownPlaceholder,
              content_standard: markdownPlaceholder,
              importedPdfData: dataUrl,
              importedPdfName: file.name,
              lastUpdated: new Date().toISOString()
            };

            await updateDoc(getTopicDocRef(), updateFields);
            const updatedTopic = { ...topic, ...updateFields };
            setLocalTopic(updatedTopic);
            if (onTopicUpdate) onTopicUpdate(updatedTopic);
            alert('Parabéns! Documento importado e adicionado ao tópico com sucesso.');
          }
        }
      } catch (err: any) {
        console.error('[Import Error]:', err);
        alert('Erro ao importar resumo/documento: ' + (err?.message || 'Falha no processamento.'));
      } finally {
        setIsImporting(false);
        await fetchQuota();
      }
    };

    input.click();
  };

  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [flashcardCount, setFlashcardCount] = useState(0);
  const countCache = useRef<Record<string, {q: number, f: number}>>({});

  useEffect(() => {
    const fetchCounts = async () => {
      if (countCache.current[topic.id]) {
        setQuestionCount(countCache.current[topic.id].q);
        setFlashcardCount(countCache.current[topic.id].f);
        return;
      }
      try {
        const { getCountFromServer } = await import('../firebase');
        const qQuestions = query(collection(db, 'questions'), where('topicId', '==', topic.id));
        const qFlashcards = query(collection(db, 'flashcards'), where('topicId', '==', topic.id));
        
        // Parallel counts to be fast and cheap
        const [questionsSnap, flashcardsSnap] = await Promise.all([
          getCountFromServer(qQuestions),
          getCountFromServer(qFlashcards)
        ]);
        
        const q = questionsSnap.data().count;
        const f = flashcardsSnap.data().count;
        setQuestionCount(q);
        setFlashcardCount(f);
        countCache.current[topic.id] = { q, f };
      } catch (e) {
        console.warn('Count optimization failed (max 1 read):', e);
        setQuestionCount(0);
        setFlashcardCount(0);
      }
    };
    fetchCounts();
  }, [topic.id]);

  const handleGenerateQuestions = async () => {
    if (!checkCreditsSufficient(3)) {
      return;
    }
    setIsGeneratingQuestions(true);
    try {
      const subjectName = subjects.find(s => s.id === topic.subjectId)?.name || '';
      const newQuestions = await generateQuestions(topic.title, subjectName, 10, [], userId, undefined);
      
      if (newQuestions && Array.isArray(newQuestions)) {
        for (const q of newQuestions) {
          await addDoc(collection(db, 'questions'), {
            ...q,
            topicId: topic.id,
            subjectId: topic.subjectId
          });
        }
        safeLocalStorageRemove(`questions_topic_${topic.id}`);
        if (topic.subjectId) safeLocalStorageRemove(`questions_subject_${topic.subjectId}`);
        safeLocalStorageRemove('questions_fallback');

        setQuestionCount(prev => prev + newQuestions.length);
        alert('10 novas questões geradas com sucesso!');
      }
    } catch (error: any) {
      console.error('Error saving questions:', error);
      alert(`Falha ao gerar questões: ${error.message || 'Erro desconhecido.'}`);
    } finally {
      setIsGeneratingQuestions(false);
      await fetchQuota();
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!checkCreditsSufficient(2)) {
      return;
    }
    setIsGeneratingFlashcards(true);
    try {
      const newFlashcards = await generateFlashcards(topic.title, currentContent, 10, userId);
      
      if (newFlashcards && Array.isArray(newFlashcards)) {
        for (const fData of newFlashcards) {
          const front = fData.front || fData.question || fData.pergunta || '';
          const back = fData.back || fData.answer || fData.resposta || '';
          
          await addDoc(collection(db, 'flashcards'), {
            front,
            back,
            topicId: topic.id,
            subjectId: topic.subjectId
          });
        }
        setFlashcardCount(prev => prev + newFlashcards.length);
        alert('10 novos flashcards gerados com sucesso!');
      }
    } catch (error: any) {
      console.error('Error saving flashcards:', error);
      alert(`Falha ao gerar flashcards: ${error.message || 'Erro desconhecido.'}`);
    } finally {
      setIsGeneratingFlashcards(false);
      await fetchQuota();
    }
  };

  const handleResetTopic = async () => {
    if (!confirm('Deseja realmente limpar todo o conteúdo deste resumo? Esta ação não pode ser desfeita.')) return;
    
    setIsGenerating(true);
    try {
      const updateFields: any = {
        lastUpdated: new Date().toISOString()
      };
      if (depth === 'standard') {
        updateFields.content_standard = '';
        updateFields.content = '';
      } else if (depth === 'deep') {
        updateFields.content_deep = '';
      } else if (depth === 'elite') {
        updateFields.content_elite = '';
      } else if (depth === 'master') {
        updateFields.content_master = '';
      } else if (depth === 'monograph') {
        updateFields.content_monograph = '';
      } else if (depth === 'custom_analyzed') {
        updateFields.content_custom_analyzed = '';
        updateFields.custom_analysis = null; // Clean up analysis too
      }

      await updateDoc(getTopicDocRef(), updateFields);
      setCurrentContent('');
      const updated = { ...topic, ...updateFields };
      setLocalTopic(updated);
      if (onTopicUpdate) {
        onTopicUpdate(updated);
      }
      alert('Resumo limpo com sucesso.');
    } catch (error) {
      console.error('Error resetting topic:', error);
      alert('Erro ao limpar o resumo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const isPlaceholder = !currentContent.trim() || currentContent.includes('Conteúdo em desenvolvimento');

  const getCustomMarkdownComponents = () => {
    return {
      ...markdownComponents,
      img: (props: any) => {
        if (depth === 'custom_analyzed') {
          const StandardImg = markdownComponents.img;
          return StandardImg ? <StandardImg {...props} /> : <img {...props} />;
        }
        if (illustrationLevel === 'minimum') {
          return null;
        }
        const StandardImg = markdownComponents.img;
        return StandardImg ? <StandardImg {...props} /> : <img {...props} />;
      },
      blockquote: (props: any) => {
        if (alertBoxLevel === 'minimum') {
          return (
            <div className="border-l-2 border-stone-300 pl-4 py-2 text-stone-600 italic my-4 text-sm">
              {props.children}
            </div>
          );
        }
        const StandardBlockquote = markdownComponents.blockquote;
        return StandardBlockquote ? <StandardBlockquote {...props} /> : <blockquote {...props} />;
      }
    };
  };

  const customMarkdownComponents = useMemo(() => getCustomMarkdownComponents(), [depth, illustrationLevel, alertBoxLevel]);

  const wordCount = useMemo(() => {
    if (!currentContent) return 0;
    return currentContent.trim().split(/\s+/).filter(Boolean).length;
  }, [currentContent]);

  const readingTime = useMemo(() => {
    return Math.max(1, Math.ceil(wordCount / 200));
  }, [wordCount]);

  const processedContent = useMemo(() => {
    const raw = renderContentWithHighlights(currentContent, highlights);
    return sanitizeMarkdown(raw);
  }, [currentContent, highlights]);

  const renderedNormalMarkdown = useMemo(() => {
    return (
      <ReactMarkdown 
        remarkPlugins={[remarkGfm, remarkMath]} 
        rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: 'ignore' }]]}
        components={customMarkdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    );
  }, [processedContent, customMarkdownComponents]);

  const renderedExpandedMarkdown = useMemo(() => {
    return (
      <ReactMarkdown 
        remarkPlugins={[remarkGfm, remarkMath]} 
        rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: 'ignore' }]]}
        components={customMarkdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    );
  }, [processedContent, customMarkdownComponents]);

  return (
    <div className="max-w-5xl mx-auto space-y-12 transition-all duration-300">
      <div className="space-y-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-[#E2E0D9] pb-6 gap-4">
          <div className="text-[11px] uppercase tracking-widest text-[#8E8A82] font-bold text-center sm:text-left">
            Matérias &rsaquo; {topic.title}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
            {globalQuota && (
              <div className="flex flex-col items-end mr-4">
                <div className="text-[9px] uppercase font-black text-[#8E8A82]">Cotas Globais</div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-[#E2E0D9] rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${(globalQuota.limit - globalQuota.available) / globalQuota.limit > 0.8 ? 'bg-red-500' : 'bg-primary'}`} 
                      style={{ width: `${Math.min(100, (globalQuota.available / globalQuota.limit) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[#1A1A1A]">{globalQuota.available}/{globalQuota.limit}</span>
                </div>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={onBack} className="border-[#E2E0D9] text-[10px] uppercase tracking-widest font-bold h-9 px-4">
              <ArrowLeft className="w-3 h-3 mr-2" /> Voltar
            </Button>
            <Button 
              variant={isCompleted ? "outline" : "default"} 
              size="sm"
              className="text-[10px] uppercase tracking-widest font-bold h-9 px-4"
              onClick={onComplete}
            >
              <CheckCircle2 className={`w-3 h-3 mr-2 ${isCompleted ? 'text-green-500' : ''}`} />
              {isCompleted ? 'Concluído' : 'Marcar'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="text-[10px] uppercase tracking-widest font-bold h-9 px-4 bg-white border-[#E2E0D9] text-stone-850 hover:bg-[#FBFBFA] flex items-center gap-1.5"
              onClick={() => {
                localStorage.setItem('cross_app_nav_topic_id', topic.id);
                localStorage.setItem('was_navigated_from_internato', 'true');
                if (onToggleAppMode) {
                  onToggleAppMode();
                }
              }}
            >
              <Brain className="w-3.5 h-3.5 text-stone-500" />
              Ver no MedRevise
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="text-[10px] uppercase tracking-widest font-bold h-9 px-4 bg-[#F2F2F0] border-[#E2E0D9] text-stone-850 hover:bg-[#EAEAEA] flex items-center gap-1.5"
              onClick={() => {
                // Set cross-app navigation states
                localStorage.setItem('cross_app_nav_topic_id', topic.id);
                localStorage.setItem('was_navigated_from_internato', 'true');
                localStorage.setItem('auto_trigger_review_panel', 'true');
                
                if (onToggleAppMode) {
                  onToggleAppMode();
                }
              }}
            >
              <Brain className="w-3.5 h-3.5 text-amber-600" />
              Revisar no MedRevise
            </Button>
            {currentContent && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[10px] uppercase tracking-widest font-bold h-9 px-3.5 bg-red-50/80 text-red-700 border-red-200 hover:bg-red-100 flex items-center gap-1.5 rounded-lg shadow-2xs"
                onClick={handleDeleteSummary}
                title="Apagar este resumo para refazer do zero"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" /> Excluir Resumo
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-[10px] uppercase tracking-widest font-bold h-9 px-4 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
              onClick={async () => {
                if (window.confirm("Deseja realmente excluir este tópico permanentemente?")) {
                  try {
                    await deleteDoc(getTopicDocRef());
                    // Trigger onTopicUpdate with null/empty state or clean up parent
                    if (onTopicUpdate) {
                      // Call onTopicUpdate to let App.tsx know it has been deleted
                      onTopicUpdate({ ...topic, deleted: true } as any);
                    }
                    if (onBack) onBack();
                  } catch (e: any) {
                    console.error('Erro ao excluir:', e);
                    alert('Erro ao excluir o tópico: ' + e.message);
                  }
                }
              }}
            >
              <Trash2 className="w-3 h-3 mr-1.5" /> Excluir
            </Button>
          </div>
        </div>

        {/* Persistent Depth Selection Tabs Bar */}
        <div className="bg-[#FBFBFA] border border-[#E2E0D9] p-3 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-[#1A1A1A] px-2">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span>Versões de Resumo:</span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-1.5 bg-white p-1.5 rounded-xl border border-[#E2E0D9] w-full md:w-auto">
            {getAvailableDepths(topic).length === 0 ? (
              <span className="text-[10px] font-bold text-stone-400 px-3 py-1.5">Nenhuma versão gerada</span>
            ) : (
              getAvailableDepths(topic).map((avail) => (
                <Button
                  key={avail.depth}
                  onClick={() => setDepth(avail.depth)}
                  variant="ghost"
                  className={`h-9 px-3 text-[10px] sm:text-[11px] font-black uppercase tracking-tight rounded-lg transition-all ${
                    depth === avail.depth
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                  }`}
                >
                  {avail.label}
                </Button>
              ))
            )}
            
            <div className="w-px h-6 bg-stone-200 mx-1 hidden sm:block"></div>
            <Button
              onClick={() => setShowSummaryWizard(true)}
              variant="ghost"
              className="h-9 px-3 text-[10px] sm:text-[11px] font-black uppercase tracking-tight rounded-lg transition-all text-amber-600 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Novo
            </Button>
          </div>
        </div>

        {/* Empty State / Generation Banner */}
        {getAvailableDepths(topic).length === 0 && !isGenerating && (
          <div className="flex flex-col items-center text-center p-8 bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-3xl space-y-4 my-6">
            <div className="bg-indigo-100 p-4 rounded-full text-indigo-600">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-indigo-900">
                Nenhum Resumo Gerado
              </h4>
              <p className="text-sm text-indigo-700 max-w-lg mx-auto">
                Utilize nossa IA médica para gerar um resumo completo e estruturado para este tópico, perfeitamente adaptado para as suas provas de residência.
              </p>
            </div>
            <Button 
              onClick={() => setShowSummaryWizard(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest px-6 py-3.5 rounded-xl shadow-lg shadow-indigo-200 min-h-12 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Sparkles className="w-4 h-4" />
              Criar Primeiro Resumo
            </Button>
          </div>
        )}

        {/* Progress Bar when Generating */}
        {isGenerating && monographProgress && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-6 p-5 bg-indigo-50/50 rounded-2xl border-2 border-indigo-200/50 shadow-sm"
          >
            <div className="flex justify-between items-center text-[10px] sm:text-[11px] uppercase font-black text-indigo-700 mb-3 tracking-wider">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                {monographProgress.message}
              </span>
              <span className="bg-white px-2 py-1 rounded text-indigo-600 border border-indigo-100 shadow-sm">{Math.round((monographProgress.current / monographProgress.total) * 100)}%</span>
            </div>
            <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-indigo-100/50 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300 relative"
                style={{ width: `${(monographProgress.current / monographProgress.total) * 100}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Reading Customizer Panel */}
        {!isPlaceholder && (
          <div className="bg-[#FAF9F5] border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-[#D44E3D]/10 text-[#D44E3D] p-2 rounded-xl mt-0.5 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  Personalizador de Leitura & Preceptoria
                </h4>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                  As configurações de preceptoria deste resumo gerado estão ativas: Casos Clínicos <strong>{illustrationLevel === 'minimum' ? 'Desativados' : illustrationLevel === 'moderate' ? '1 Caso/Patologia' : 'Detalhados'}</strong>, Dicas <strong>{alertBoxLevel === 'minimum' ? 'Mínimas' : alertBoxLevel === 'moderate' ? 'Médias' : 'Máximas'}</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:items-end shrink-0">
              {depth === 'custom_analyzed' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 rounded-full border border-emerald-100 self-start sm:self-end">
                  ✓ Resumo Inteligente Ativo
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  let count = 0;
                  for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('img_override_')) {
                      localStorage.removeItem(key);
                      count++;
                    }
                  }
                  if (count > 0) {
                    window.dispatchEvent(new Event('image-override-updated'));
                    alert('Imagens ocultadas restauradas com sucesso!');
                  } else {
                    alert('Nenhuma imagem ocultada para restaurar.');
                  }
                }}
                className="text-[10px] font-extrabold text-[#D44E3D] hover:underline uppercase tracking-wider flex items-center gap-1 cursor-pointer self-start sm:self-end mt-1"
              >
                Restaurar Imagens Ocultas
              </button>
            </div>
          </div>
        )}



        <article className="prose prose-slate max-w-none">
          {/* Refined Top Context & Minimalist Action Toolbar Header */}
          <div className="mb-6 space-y-4 not-prose select-none">
            {/* Context & Regional Tags Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#FAF9F6] border border-[#E2E0D9] rounded-2xl shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-[#D44E3D]/10 text-[#D44E3D] text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#D44E3D]/20">
                  <Zap className="w-3 h-3 text-[#D44E3D]" />
                  Foco Regional: GO/DF & PSU
                </span>
                <span className="text-[11px] text-[#6E6A62] font-semibold tracking-wide bg-white/80 px-2.5 py-0.5 rounded-md border border-[#E2E0D9]/60">
                  UFG • UnB • PSU-GO • PSU-DF • SES • ENARE
                </span>
              </div>

              <div className="flex items-center gap-2 text-[10.5px] font-medium text-[#8E8A82]">
                <span className="hidden sm:inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-[#E2E0D9]">
                  Ref: <strong className="text-[#2C2B29]">{referencePref || 'Diretrizes Atuais'}</strong>
                </span>
                {isCachedOffline ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-md border border-emerald-300 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Cache Offline Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-stone-100 text-stone-600 font-medium px-2.5 py-1 rounded-md border border-stone-200">
                    <WifiOff className="w-3 h-3 text-stone-400 shrink-0" />
                    Online
                  </span>
                )}
              </div>
            </div>

            {/* If no generated content (placeholder view), show title here */}
            {isPlaceholder && (
              <h1 className="text-3xl sm:text-5xl font-display font-black leading-tight text-[#1A1A1A] pt-2">
                {sanitizeTitle(topic.title)}
              </h1>
            )}

            {/* Unified Minimalist Control Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-[#FAF9F6] border border-[#E2E0D9] rounded-2xl shadow-xs">
              {/* Left Group: Document Utilities */}
              <div className="flex flex-wrap items-center gap-1.5">
                {!isPlaceholder && (
                  <Button 
                    variant="ghost"
                    onClick={toggleOfflineCache}
                    className={cn(
                      "h-8 px-3 rounded-xl border text-[10.5px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                      isCachedOffline 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-xs" 
                        : "bg-white border-[#E2E0D9] hover:bg-[#F3F1EC] text-[#2C2B29]"
                    )}
                    title={isCachedOffline ? "Remover resumo do cache offline local" : "Salvar resumo no cache do navegador para ler offline sem baixar arquivo"}
                  >
                    {isCachedOffline ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Salvo Offline</span>
                      </>
                    ) : (
                      <>
                        <HardDriveDownload className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Salvar Offline (Cache)</span>
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Right Group: Interactive Reading Suite */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button 
                  variant="ghost"
                  onClick={() => setIsExpandedViewOpen(true)}
                  disabled={isPlaceholder}
                  className="h-8 px-3 rounded-xl bg-white border border-[#E2E0D9] hover:bg-[#F3F1EC] text-[10.5px] font-bold uppercase tracking-wider text-[#2C2B29] transition-all disabled:opacity-40"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                  Tela Cheia
                </Button>

                <Button 
                  variant="ghost"
                  onClick={() => setShowNotebook(!showNotebook)}
                  disabled={isPlaceholder}
                  className={cn(
                    "h-8 px-3 rounded-xl text-[10.5px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 border",
                    showNotebook 
                      ? "bg-[#D44E3D]/10 text-[#D44E3D] border-[#D44E3D]/30 shadow-2xs font-extrabold" 
                      : "bg-white border-[#E2E0D9] hover:bg-[#F3F1EC] text-[#2C2B29]"
                  )}
                >
                  <Notebook className="w-3.5 h-3.5 mr-1.5" />
                  Caderno
                </Button>


              </div>
            </div>
          </div>

          {/* Top Notebook Panel (Moved from Sidebar to Top) */}
          {showNotebook && !topic.importedPdfData && !isExpandedViewOpen && !isEditingContent && (
            <div className="w-full bg-[#FBFBFA] border border-[#E2E0D9] rounded-2xl p-6 shadow-sm mb-6 select-none transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E2E0D9] pb-4 mb-4 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#D44E3D]/10 text-[#D44E3D] rounded-xl">
                    <Notebook className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#1A1A1A]">Meu Caderno de Notas & Recortes do Tópico</h3>
                    <p className="text-[11px] text-[#8E8A82]">Trechos grifados, anotações e recortes salvos para revisão acelerada.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className="text-xs bg-[#D44E3D]/10 text-[#D44E3D] px-3 py-1 rounded-full font-bold">
                    {clippings.length} recortes • {highlights.length} grifos
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNotebook(false)}
                    className="text-stone-400 hover:text-stone-700 h-8 w-8 p-0 rounded-xl"
                    title="Ocultar Caderno"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {clippings.length === 0 && highlights.length === 0 ? (
                <div className="text-center py-8 text-[#8E8A82]">
                  <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-25" />
                  <p className="text-xs leading-relaxed font-medium">
                    Selecione qualquer trecho do texto do resumo para <span className="font-bold underline text-[#D44E3D]">grifar</span> ou <span className="font-bold underline text-[#D44E3D]">salvar recortes</span> em categorias!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto p-1 scrollbar-thin">
                  {/* CLIPPINGS BY CATEGORY */}
                  {CLIPPING_CATEGORIES.map((cat) => {
                    const catClippings = clippings.filter(c => c.category === cat.id);
                    if (catClippings.length === 0) return null;
                    
                    return (
                      <div key={`main-cat-${cat.id}`} className="border border-[#E2E0D9] rounded-xl overflow-hidden bg-white shadow-xs flex flex-col">
                        <div className="bg-[#F4F2EE] px-3 py-2 text-xs font-bold text-[#1A1A1A] flex justify-between items-center border-b border-[#E2E0D9]">
                          <span>{cat.label}</span>
                          <span className="text-[9px] bg-slate-200 px-2 py-0.5 rounded-full font-bold text-gray-600">
                            {catClippings.length}
                          </span>
                        </div>
                        <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-60 scrollbar-thin">
                          {catClippings.map((clip, clipIdx) => (
                            <div 
                              key={`main-clip-${clip.id}-${clipIdx}`}
                              onClick={() => scrollToText(clip.text, undefined, clip.occurrence)}
                              className="group/clip bg-[#FBFBFA] p-3 rounded-xl border border-[#E2E0D9]/70 hover:border-[#D44E3D]/40 hover:bg-[#D44E3D]/[0.02] transition-all text-xs relative cursor-pointer"
                              title="Clique para rolar até este trecho no resumo"
                            >
                              <p className="text-stone-800 leading-relaxed pr-2 font-sans italic text-xs">"{clip.text}"</p>
                              <div className="mt-2.5 flex items-center justify-between text-[9.5px] text-[#8E8A82] border-t border-dashed border-[#E2E0D9] pt-2">
                                <span>{new Date(clip.createdAt).toLocaleDateString('pt-BR')}</span>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(clip.text);
                                      setShowCopyStatus(prev => ({ ...prev, [clip.id]: true }));
                                      setTimeout(() => {
                                        setShowCopyStatus(prev => ({ ...prev, [clip.id]: false }));
                                      }, 1500);
                                    }}
                                    className="hover:text-[#D44E3D] font-bold uppercase transition-colors flex items-center gap-1 text-[9px]"
                                  >
                                    {showCopyStatus[clip.id] ? <Check className="w-2.5 h-2.5 text-green-600" /> : <Copy className="w-2.5 h-2.5" />}
                                    {showCopyStatus[clip.id] ? 'Copiado' : 'Copiar'}
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeepenNotebookItem(clip, 'clipping');
                                    }}
                                    className="hover:text-amber-600 font-bold uppercase transition-colors flex items-center gap-1 text-[9px] text-[#C2410C]"
                                    title="Aprofundar com Preceptor IA (3 créditos)"
                                  >
                                    <Brain className="w-2.5 h-2.5 text-orange-600" />
                                    Aprofundar IA (3cr)
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('Deseja excluir este recorte?')) {
                                        removeClipping(clip.id);
                                      }
                                    }}
                                    className="hover:text-red-600 font-bold uppercase transition-colors text-[9px]"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* HIGHLIGHTS SECTION */}
                  {highlights.length > 0 && (
                    <div className="border border-[#E2E0D9] rounded-xl overflow-hidden bg-white shadow-xs flex flex-col">
                      <div className="bg-[#F4F2EE] px-3 py-2 text-xs font-bold text-[#1A1A1A] flex justify-between items-center border-b border-[#E2E0D9]">
                        <span>✨ Trechos Grifados</span>
                        <span className="text-[9px] bg-slate-200 px-2 py-0.5 rounded-full font-bold text-gray-600">
                          {highlights.length}
                        </span>
                      </div>
                      <div className="p-3 space-y-2 flex-1 overflow-y-auto max-h-60 scrollbar-thin">
                        {highlights.map((hl, hlIdx) => {
                          const hasStrokes = (() => {
                            try {
                              const key = userId ? `smart_pen_drawings_${userId}_highlight_${hl.id}` : `smart_pen_drawings_highlight_${hl.id}`;
                              const saved = safeLocalStorageGet(key);
                              return saved ? JSON.parse(saved).length > 0 : false;
                            } catch {
                              return false;
                            }
                          })();
                          return (
                            <div 
                              key={`main-hl-${hl.id}-${hlIdx}`} 
                              onClick={() => scrollToText(hl.text, hl.id)}
                              style={{ backgroundColor: `${hl.color}18`, borderColor: hl.color }}
                              className="group p-2.5 rounded-xl border hover:scale-[1.01] hover:border-[#D44E3D]/40 cursor-pointer transition-all relative flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 overflow-hidden mr-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: hl.color }} />
                                <span className="text-xs text-stone-800 font-medium truncate font-sans">"{hl.text}"</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeepenNotebookItem(hl, 'highlight');
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors shrink-0 flex items-center gap-1 border border-amber-200/60 bg-amber-50/80"
                                  title={hasStrokes ? "Aprofundar com Preceptor IA (5cr)" : "Aprofundar com Preceptor IA (3cr)"}
                                >
                                  <Brain className="w-3 h-3 text-orange-600 shrink-0" />
                                  <span className="text-[9px] font-bold text-orange-700">
                                    {hasStrokes ? '5cr' : '3cr'}
                                  </span>
                                </button>
                                <button
                                  onClick={(e) => handleDeleteHighlight(e, hl.id)}
                                  className="p-1 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors shrink-0"
                                >
                                  <X className="w-3.5 h-3.5 shrink-0" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isEditingContent ? (
            <div className="bg-[#FBFBFA] border-2 border-[#D44E3D]/30 rounded-2xl p-6 shadow-md mb-12 space-y-5">
              {/* Editor Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E2E0D9] pb-4 gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1A1A1A] flex items-center gap-2 uppercase tracking-widest">
                    <Edit3 className="w-4 h-4 text-[#D44E3D]" /> Editor de Resumo Real & Estruturado
                  </h3>
                  <p className="text-[11px] text-[#8E8A82] mt-0.5">
                    Edite o conteúdo em formato real e insira quadros de destaque, tabelas, dicas e casos clínicos em 1 clique.
                  </p>
                </div>

                {/* View Mode Selector: Split | Visual | Code */}
                <div className="flex bg-stone-200/80 p-1 rounded-xl border border-stone-300/60 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setEditViewMode('split')}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5",
                      editViewMode === 'split' ? "bg-white text-[#D44E3D] shadow-xs" : "text-stone-600 hover:text-stone-900"
                    )}
                  >
                    <Columns className="w-3.5 h-3.5" /> Lado a Lado
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditViewMode('visual')}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5",
                      editViewMode === 'visual' ? "bg-white text-[#D44E3D] shadow-xs" : "text-stone-600 hover:text-stone-900"
                    )}
                  >
                    <Eye className="w-3.5 h-3.5" /> Visualização Real
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditViewMode('code')}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5",
                      editViewMode === 'code' ? "bg-white text-[#D44E3D] shadow-xs" : "text-stone-600 hover:text-stone-900"
                    )}
                  >
                    <FileText className="w-3.5 h-3.5" /> Editor Direto
                  </button>
                </div>
              </div>

              {/* Toolbar for Quadros & Quick Insertions */}
              <div className="bg-white p-3 rounded-xl border border-[#E2E0D9] shadow-xs space-y-2.5">
                {/* Quadros Especiais */}
                <div className="flex items-center gap-1.5 flex-wrap border-b border-[#E2E0D9]/70 pb-2.5">
                  <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82] mr-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Adicionar Quadros:
                  </span>
                  <button
                    type="button"
                    onClick={() => insertSnippet('\n\n> [!TIP]\n> 💡 **DICA DE PROVA / PRECEPTORIA**\n> ', '\n\n', 'Escreva aqui a dica prática, macete ou pegadinha...')}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                  >
                    <Lightbulb className="w-3 h-3 text-emerald-600" /> + Quadro Dica / Macete
                  </button>

                  <button
                    type="button"
                    onClick={() => insertSnippet('\n\n> [!CLINICAL_CASE]\n> 🩺 **CASO CLÍNICO PRÁTICO**\n> **História:** Paciente de 45 anos apresenta...\n> **Conduta Imediata:** ', '\n\n', 'Resumo do atendimento...')}
                    className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                  >
                    <Stethoscope className="w-3 h-3 text-purple-600" /> + Caso Clínico
                  </button>

                  <button
                    type="button"
                    onClick={() => insertSnippet('\n\n> [!CAUTION]\n> ⚠️ **ATENÇÃO / DIAGNÓSTICO DIFERENCIAL**\n> ', '\n\n', 'Não confunda a conduta de X com a de Y...')}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                  >
                    <AlertCircle className="w-3 h-3 text-rose-600" /> + Quadro Atenção
                  </button>

                  <button
                    type="button"
                    onClick={() => insertSnippet('\n\n> [!CHECKLIST]\n> 📋 **CONDUTA DE BEIRA DE LEITO**\n> 1. [ ] Estabilização inicial\n> 2. [ ] Exames diagnósticos\n> 3. [ ] Prescrição: ', '\n\n', 'Medicamento de escolha...')}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                  >
                    <CheckCircle2 className="w-3 h-3 text-indigo-600" /> + Quadro Conduta
                  </button>

                  <button
                    type="button"
                    onClick={() => insertSnippet('\n\n| Critério | Diagnóstico A | Diagnóstico B |\n|---|---|---|\n| **Sinal Patognomônico** | Sinal A | Sinal B |\n| **Exame de Escolha** | Exame A | Exame B |\n| **Primeira Linha** | Droga A | Droga B |\n\n', '', '')}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                  >
                    <FileText className="w-3 h-3 text-blue-600" /> + Tabela Comparativa
                  </button>

                  <button
                    type="button"
                    onClick={() => insertSnippet('\n\n> [!SUMMARY]\n> 📌 **RESUMO DE PONTOS CHAVE**\n> - ', '\n\n', 'Ponto fundamental para o edital...')}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                  >
                    <Zap className="w-3 h-3 text-amber-600" /> + Quadro Destaque
                  </button>
                </div>

                {/* Formatação Estrutural de Texto */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82] mr-1">
                    Formatação:
                  </span>
                  <button
                    type="button"
                    onClick={() => insertSnippet('\n# ', '\n', 'Título Principal')}
                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-black text-xs"
                    title="Título H1"
                  >
                    H1
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('\n## ', '\n', 'Seção')}
                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-black text-xs"
                    title="Subtítulo H2"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('\n### ', '\n', 'Subseção')}
                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-black text-xs"
                    title="Tópico H3"
                  >
                    H3
                  </button>
                  <span className="w-px h-4 bg-stone-300 mx-1" />
                  <button
                    type="button"
                    onClick={() => insertSnippet('**', '**', 'negrito')}
                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-extrabold text-xs"
                    title="Negrito"
                  >
                    <b>B</b>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('*', '*', 'itálico')}
                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded italic font-serif text-xs"
                    title="Itálico"
                  >
                    <i>I</i>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('==', '==', 'texto grifado')}
                    className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold text-xs"
                    title="Grifar Texto"
                  >
                    Grifar
                  </button>
                  <span className="w-px h-4 bg-stone-300 mx-1" />
                  <button
                    type="button"
                    onClick={() => insertSnippet('\n- ', '\n', 'Item de Lista')}
                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-xs font-bold"
                    title="Lista com marcadores"
                  >
                    • Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('\n1. ', '\n', 'Item numerado')}
                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-xs font-bold"
                    title="Lista numerada"
                  >
                    1. Numerada
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('\n\n---\n\n', '', '')}
                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-xs font-bold"
                    title="Linha divisória"
                  >
                    — Divisor
                  </button>
                </div>
              </div>

              {/* Editor Main Content Area */}
              <div className="grid grid-cols-1 gap-6 min-h-[480px]">
                {editViewMode === 'split' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                    <div className="flex flex-col space-y-2">
                      <div className="text-[10px] uppercase tracking-widest font-extrabold text-stone-500 flex justify-between">
                        <span>✍️ Digitação e Inserção de Conteúdo</span>
                        <span>Edite em tempo real</span>
                      </div>
                      <textarea
                        ref={editorTextareaRef}
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="w-full h-[520px] p-4 border border-[#E2E0D9] bg-white rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D44E3D]/40 focus:border-[#D44E3D] resize-y leading-relaxed shadow-inner"
                        placeholder="# Título do Resumo&#10;&#10;Escreva ou cole aqui as suas anotações para este tópico..."
                      />
                    </div>

                    <div className="flex flex-col space-y-2">
                      <div className="text-[10px] uppercase tracking-widest font-extrabold text-[#D44E3D] flex justify-between">
                        <span>✨ Resultado Formatado (Forma Real)</span>
                        <span>Atualização instantânea</span>
                      </div>
                      <div className="w-full h-[520px] p-6 border border-[#E2E0D9] bg-white rounded-xl overflow-y-auto shadow-xs markdown-body prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed scrollbar-thin">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]} 
                          rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: 'ignore' }]]}
                          components={customMarkdownComponents}
                        >
                          {parseMarkdownAlerts(editedContent)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}

                {editViewMode === 'visual' && (
                  <div className="flex flex-col space-y-2">
                    <div className="text-[10px] uppercase tracking-widest font-extrabold text-[#D44E3D] flex justify-between">
                      <span>✨ Visualização Completa Formatada (Forma Real)</span>
                      <span>Documento Final</span>
                    </div>
                    <div className="w-full min-h-[500px] p-8 sm:p-12 border border-[#E2E0D9] bg-white rounded-2xl shadow-xs markdown-body prose prose-slate max-w-none leading-relaxed">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkMath]} 
                        rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: 'ignore' }]]}
                        components={customMarkdownComponents}
                      >
                        {parseMarkdownAlerts(editedContent)}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {editViewMode === 'code' && (
                  <div className="flex flex-col space-y-2">
                    <div className="text-[10px] uppercase tracking-widest font-extrabold text-stone-500 flex justify-between">
                      <span>✍️ Editor Expandido de Resumo</span>
                      <span>Modo Focado</span>
                    </div>
                    <textarea
                      ref={editorTextareaRef}
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full h-[520px] p-5 border border-[#E2E0D9] bg-white rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D44E3D]/40 focus:border-[#D44E3D] resize-y leading-relaxed shadow-inner"
                      placeholder="# Título do Resumo&#10;&#10;Escreva ou cole aqui as suas anotações para este tópico..."
                    />
                  </div>
                )}
              </div>

              {/* Footer Save & Cancel Buttons */}
              <div className="flex items-center justify-between border-t border-[#E2E0D9] pt-4 mt-4">
                <div className="text-[11px] text-stone-500 italic">
                  Clique em <b>Salvar Resumo</b> para confirmar as alterações no banco de dados.
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={() => setIsEditingContent(false)}
                    className="text-[10px] uppercase tracking-widest font-bold h-10 px-5 rounded-xl border border-stone-200 hover:bg-stone-100"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSaveManualContent}
                    className="bg-[#D44E3D] hover:bg-[#b83d2e] text-white text-[10px] uppercase tracking-widest font-black h-10 px-6 rounded-xl shadow-xs gap-2"
                  >
                    <Check className="w-4 h-4" /> Salvar Resumo Formatado
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 mb-12 items-start relative select-text w-full">
              <div 
                ref={pdfRef} 
                onMouseUp={() => handleTextSelection()}
                onTouchEnd={() => handleTextSelection()}
                onClick={handleContentClick}
                className="w-full bg-white p-6 sm:p-10 md:p-14 pdf-export-reset border border-[#E2E0D9] rounded-2xl shadow-[0_10px_38px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.02)] print-page-target select-text overflow-hidden relative"
              >
                {!isExpandedViewOpen && (
                  <SmartPenCanvas 
                    topicId={`${topic.id}_${depth}`}
                    isPenModeActive={isPenModeActive}
                    penColor={penColor}
                    penThickness={penThickness}
                    brushType={penBrushType}
                    containerRef={pdfRef}
                    userId={userId}
                    isVisible={showDrawings}
                  />
                )}
              {isExpandedViewOpen ? (
                <div className="py-12 text-center text-[#8E8A82] text-xs italic select-none">
                  O conteúdo do resumo está atualmente ativo no modo de leitura expandido (Tela Cheia).
                </div>
              ) : topic.importedPdfData ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E2E0D9] pb-4 gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">{topic.importedPdfName || "Documento Original"}</h3>
                        <p className="text-[9px] text-[#8E8A82] uppercase tracking-widest font-black mt-0.5">Disposto na página como resumo - sem IA</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = topic.importedPdfData!;
                          link.download = topic.importedPdfName || "documento.pdf";
                          link.click();
                        }}
                        className="text-[9px] uppercase tracking-widest font-black h-9 border-[#E2E0D9]"
                      >
                        <Download className="w-3 h-3 mr-1.5" /> Baixar
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={async () => {
                          if (confirm('Deseja realmente remover o documento anexo deste tópico?')) {
                            try {
                              const updateFields = {
                                importedPdfData: null,
                                importedPdfName: null,
                                content: '',
                                content_standard: '',
                                lastUpdated: new Date().toISOString()
                              } as any;
                              await updateDoc(getTopicDocRef(), updateFields);
                              const updatedTopic = { ...topic };
                              delete updatedTopic.importedPdfData;
                              delete updatedTopic.importedPdfName;
                              updatedTopic.content = '';
                              updatedTopic.content_standard = '';
                              setLocalTopic(updatedTopic);
                              setCurrentContent('');
                              if (onTopicUpdate) onTopicUpdate(updatedTopic);
                            } catch (e) {
                              console.error(e);
                            }
                          }
                        }}
                        className="text-[9px] uppercase tracking-widest font-black text-red-500 hover:text-red-700 hover:bg-red-50 h-9"
                      >
                        <X className="w-3 h-3 mr-1.5" /> Remover
                      </Button>
                    </div>
                  </div>
                  {topic.importedPdfData.startsWith('data:application/pdf') || topic.importedPdfName?.toLowerCase().endsWith('.pdf') ? (
                    <div className="w-full h-[750px] border border-[#E2E0D9] rounded-xl overflow-hidden bg-slate-50 shadow-inner relative">
                      <iframe 
                        src={`${topic.importedPdfData}#toolbar=1`} 
                        className="w-full h-full border-none" 
                        title={topic.importedPdfName || "Visualizador"}
                      />
                    </div>
                  ) : (
                    <div className="w-full flex justify-center p-4 bg-slate-50 rounded-xl border border-[#E2E0D9] overflow-auto max-h-[800px]">
                      <img 
                        src={topic.importedPdfData} 
                        alt={topic.importedPdfName || "Anexo original"} 
                        className="max-w-full h-auto rounded-lg shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <SummaryDossierHeader 
                    title={topic.title}
                    subjectName={subjects.find(s => s.id === topic.subjectId)?.name}
                    depth={depth}
                    lastUpdated={topic.lastUpdated}
                    wordCount={wordCount}
                    readingTime={readingTime}
                    hideTitle={currentContent.trim().startsWith('# ')}
                  />

                  <div className="markdown-body prose prose-slate max-w-none">
                    {renderedNormalMarkdown}
                  </div>

                  {showResumeOption && (
                    <div className="mt-8 p-6 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100/60 flex items-center justify-center shrink-0 border border-amber-200/60">
                          {hasErrorInContent ? (
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                          ) : (
                            <Sparkles className="w-5 h-5 text-amber-600 fill-amber-500/10" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-amber-950">
                            {hasErrorInContent ? 'Geração Interrompida ou com Erros' : 'Opção de Continuar / Retomar Geração'}
                          </h4>
                          <p className="text-xs text-amber-900/85 mt-1 leading-relaxed">
                            {hasErrorInContent 
                              ? 'Alguma seção ou capítulo deste resumo falhou em carregar completamente devido à instabilidade na rede ou limites temporários de cota. Seus créditos do site foram preservados! Clique abaixo para retomar a geração seletiva de onde parou.'
                              : 'Se este resumo parecer incompleto, curto demais ou interrompido no meio por flutuações de rede, você pode clicar abaixo para acionar a continuação inteligente e gerar as seções restantes mantendo o conteúdo atual!'}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleResumeAI}
                        disabled={isGenerating}
                        className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-2.5 rounded-xl shadow-md shrink-0 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        {hasErrorInContent ? 'Retomar e Concluir' : 'Continuar de onde parou'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          )}
          
          {/* Practice Section - Single Column Focused */}
          {!isPlaceholder && (
            <div className="flex flex-col gap-6 mt-16 mb-20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-[#E2E0D9] shadow-none rounded-xl bg-[#FBFBFA] p-6 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-[#8E8A82] mb-4 flex justify-between">
                      Prática Flashcards <span>{flashcardCount} cards</span>
                    </div>
                    <p className="text-[11px] text-[#8E8A82] italic mb-6">Memorize os conceitos fundamentais deste tópico através de repetição espaçada.</p>
                  </div>
                  <div className="space-y-2">
                    {flashcardCount > 0 && onStartFlashcards && (
                      <Button 
                        onClick={onStartFlashcards}
                        className="w-full bg-[#1A1A1A] hover:bg-black text-white text-[10px] uppercase tracking-widest font-bold h-11 gap-2 cursor-pointer flex items-center justify-center shadow-sm"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Iniciar Revisão de Flashcards ({flashcardCount})
                      </Button>
                    )}
                    <Button 
                      onClick={handleGenerateFlashcards}
                      disabled={isGeneratingFlashcards}
                      variant={flashcardCount > 0 ? "outline" : "default"}
                      className={cn(
                        "w-full text-[10px] uppercase tracking-widest font-bold h-11 gap-2 cursor-pointer",
                        flashcardCount > 0 
                          ? "border-[#E2E0D9] hover:bg-slate-50 text-[#1A1A1A]" 
                          : "bg-[#1A1A1A] hover:bg-black text-white"
                      )}
                    >
                      {isGeneratingFlashcards ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                      {flashcardCount > 0 ? 'Gerar +10 Cards (2cr)' : 'Gerar 10 Flashcards (2cr)'}
                    </Button>
                  </div>
                </Card>

                <Card className="border-[#E2E0D9] shadow-none rounded-xl bg-white p-6 flex flex-col justify-between border-dashed border-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] mb-4 flex justify-between">
                      Simulado R1 (GO/DF) <span>{questionCount} questões</span>
                    </div>
                    <p className="text-[11px] text-[#8E8A82] mb-6 italic">Questões reais de provas anteriores focadas em Goiás e Brasília.</p>
                  </div>
                  <div className="space-y-2">
                    {questionCount > 0 && onStartPractice && (
                      <Button 
                        onClick={onStartPractice}
                        className="w-full bg-primary hover:bg-primary/90 text-white text-[10px] uppercase tracking-widest font-bold h-11 gap-2 cursor-pointer flex items-center justify-center shadow-sm border border-primary/20"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Responder Questões do Tema ({questionCount})
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={handleGenerateQuestions}
                      disabled={isGeneratingQuestions}
                      className="w-full border-[#E2E0D9] text-[10px] uppercase tracking-widest font-bold h-11 gap-2 cursor-pointer"
                    >
                      {isGeneratingQuestions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {questionCount > 0 ? 'Gerar +10 Questões (3cr)' : 'Gerar 10 Questões (3cr)'}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {!isPlaceholder && (
            <div className="mt-12 bg-[#FBFBFA] border border-[#E2E0D9] rounded-2xl p-8 space-y-8">
              <div>
                <h4 className="text-xs uppercase tracking-widest font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" /> Laboratório de Aprofundamento (GO/DF)
                </h4>
                <p className="text-sm text-[#8E8A82] mb-6 italic">Eleve o nível do seu resumo com detalhes técnicos de alta complexidade ou tire uma dúvida específica.</p>
                <div className="flex flex-wrap gap-3">
                  {['Fisiopatologia Molecular', 'Diagnóstico Diferencial Refinado', 'Condutas SES-GO/UnB', 'Trials e Evidências'].map((section) => (
                    <Button 
                      key={section}
                      variant="outline"
                      size="sm"
                      disabled={isDeepening}
                      onClick={() => handleDeepen(section)}
                      className="border-[#E2E0D9] hover:border-purple-600 hover:text-purple-600 text-[10px] uppercase tracking-widest font-bold transition-all"
                    >
                      {isDeepening ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
                      Explorar {section}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-[#E2E0D9]">
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#8E8A82] mb-4">Dúvida ou Tópico Específico</h4>
                <div className="flex gap-3">
                  <Input 
                    placeholder="Ex: Detalhe a farmacocinética da droga X ou a conduta na complicação Y..." 
                    value={customDeepenText}
                    onChange={(e) => setCustomDeepenText(e.target.value)}
                    className="flex-1 h-12 border-[#E2E0D9] rounded-xl text-sm"
                  />
                  <Button 
                    disabled={isDeepening || !customDeepenText.trim()}
                    onClick={() => handleDeepen('Custom', customDeepenText)}
                    className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-12 px-6 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all"
                  >
                    {isDeepening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Aprofundar (4cr)
                  </Button>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[9px] text-[#8E8A82] font-medium italic">
                  <Zap className="w-3 h-3" /> Gera conteúdo de alta fidelidade técnica (4 créditos)
                </div>
              </div>
            </div>
          )}
          
          {((topic.references && topic.references.length > 0) || referencePref) && (
            <div className="mt-16 pt-10 border-t border-[#E2E0D9]">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xs uppercase tracking-widest font-bold text-[#1A1A1A] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" /> Referências Bibliográficas e Diretrizes Técnicas
                </h4>
                {referencePref && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-200">
                    Prioridade: {referencePref}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topic.references && topic.references.length > 0 ? (
                  topic.references.map((ref, i) => (
                    <div key={`reference-${i}`} className="p-4 rounded-2xl bg-white border border-[#E2E0D9] shadow-sm space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        <span className="text-xs font-bold text-[#1A1A1A]">{ref}</span>
                      </div>
                      <p className="text-[11px] text-[#8E8A82] italic leading-relaxed">
                        Fonte científica e diretriz clínica de referência utilizada no embasamento técnico e resoluções de questões.
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-2xl bg-white border border-[#E2E0D9] shadow-sm space-y-1.5 col-span-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      <span className="text-xs font-bold text-[#1A1A1A]">{referencePref || 'UpToDate / Diretrizes da Sociedade Brasileira / Ministério da Saúde'}</span>
                    </div>
                    <p className="text-[11px] text-[#8E8A82] italic leading-relaxed">
                      Diretriz e fonte científica prioritária selecionada para embasamento técnico deste resumo de estudo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-20 pt-10 border-t border-[#E2E0D9] flex flex-col items-center justify-center space-y-4">
            <div className="text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Zona de Perigo</div>
            <Button 
              variant="ghost" 
              onClick={handleResetTopic}
              disabled={isGenerating}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-[10px] uppercase tracking-widest font-bold gap-2 h-10 px-6 rounded-xl transition-all"
            >
              <RefreshCcw className="w-4 h-4" /> Reiniciar Estudo (Limpar Resumo)
            </Button>
            <p className="text-[10px] text-[#8E8A82] text-center max-w-xs italic">
              Use esta opção se o resumo gerado apresentar erros ou se você desejar gerar uma nova versão com referências diferentes.
            </p>
          </div>
        </article>

        {/* Modal/Dialog de Sucesso para PDF e Download em Celular */}
        <AnimatePresence>
          {pdfDownloadUrl && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-3xl border border-[#E2E0D9] p-8 max-w-md w-full shadow-2xl space-y-6"
              >
                <div className="flex justify-between items-start">
                  <div className="bg-[#EFFFEC] p-3 rounded-2xl border border-green-200">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hover:bg-slate-100 h-8 w-8 text-[#8E8A82]"
                    onClick={() => {
                      URL.revokeObjectURL(pdfDownloadUrl);
                      setPdfDownloadUrl(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-display font-black text-[#1A1A1A]">Resumo Exportado!</h3>
                  <p className="text-sm text-[#8E8A82] leading-relaxed">
                    O PDF de alta fidelidade de <strong>{sanitizeTitle(topic.title)}</strong> foi gerado com sucesso para o seu celular/dispositivo.
                  </p>
                </div>

                <div className="p-4 bg-[#F2FBF0] border border-[#C5E1A5]/40 rounded-2xl flex items-start gap-3">
                  <div className="bg-[#EFFFEC] px-2 py-0.5 border border-[#81C784]/20 rounded text-[9px] font-black text-[#2E7D32] uppercase mt-0.5 shrink-0">Dica Móvel</div>
                  <p className="text-[11px] text-[#2E7D32] font-semibold leading-relaxed">
                    Em celulares (iOS/Safari e Android), use "Visualizar no Navegador" para visualizar o resumo em tela cheia e compartilhá-lo ou salvá-lo em seu aparelho via WhatsApp ou arquivos.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 pt-2">
                  <button 
                    onClick={() => {
                      if (pdfDownloadUrl) {
                        URL.revokeObjectURL(pdfDownloadUrl);
                      }
                      setPdfDownloadUrl(null);
                    }}
                    className="w-full bg-[#1A1A1A] hover:bg-black text-white text-[10px] uppercase tracking-widest font-black h-11 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#1A1A1A] shadow-sm font-sans"
                  >
                    Concluir
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* FLOATING PEN TOOLBAR */}
          {isPenModeActive && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10001] bg-[#1A1A1A]/95 backdrop-blur border border-stone-800 text-white rounded-2xl shadow-2xl py-2 px-4 flex flex-wrap items-center justify-center gap-4 animate-in fade-in slide-in-from-top-4 duration-200 select-none max-w-full">
              <span className="text-[10px] font-black text-[#8E8A82] uppercase tracking-wider pr-3 border-r border-[#E2E0D9]/10">Caneta Intel.</span>
              
              {/* Brush Selector */}
              <div className="flex bg-stone-900 rounded-lg p-0.5 gap-1 border border-stone-800 shrink-0">
                {[
                  { type: 'highlight', label: 'Marca-Texto' },
                  { type: 'pen', label: 'Canetinha' },
                  { type: 'eraser', label: 'Borracha' }
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => {
                      setPenBrushType(item.type as any);
                      // Set default thicknesses
                      if (item.type === 'highlight') setPenThickness(14);
                      else if (item.type === 'pen') setPenThickness(3.5);
                      else setPenThickness(20);
                    }}
                    className={cn(
                      "px-2.5 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all",
                      penBrushType === item.type 
                        ? "bg-[#D44E3D] text-white" 
                        : "text-stone-400 hover:text-white hover:bg-stone-800"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Color list (if not eraser) */}
              {penBrushType !== 'eraser' && (
                <div className="flex flex-wrap items-center gap-1 px-3 border-r border-l border-[#E2E0D9]/10 shrink-0 max-w-[280px]">
                  {[
                    { name: 'Preto', hex: '#1A1A1A' },
                    { name: 'Cinza', hex: '#6B7280' },
                    { name: 'Bordô', hex: '#991B1B' },
                    { name: 'Azul Escuro', hex: '#1E3A8A' },
                    { name: 'Verde Escuro', hex: '#064E3B' },
                    { name: 'Amarelo', hex: '#FEF08A' },
                    { name: 'Verde', hex: '#BBF7D0' },
                    { name: 'Rosa', hex: '#FECDD3' },
                    { name: 'Azul', hex: '#BFDBFE' },
                    { name: 'Laranja', hex: '#FED7AA' }
                  ].map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setPenColor(color.hex)}
                      style={{ backgroundColor: color.hex }}
                      className={cn(
                        "w-4 h-4 rounded-full hover:scale-115 active:scale-90 transition-all border cursor-pointer shrink-0",
                        penColor === color.hex ? "border-white scale-110 shadow-md ring-2 ring-white/10" : "border-black/20"
                      )}
                      title={color.name}
                    />
                  ))}
                </div>
              )}

              {/* Thickness Selector */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] text-stone-400 font-bold uppercase">Espessura:</span>
                <input 
                  type="range"
                  min="2"
                  max={penBrushType === 'highlight' ? "26" : penBrushType === 'eraser' ? "45" : "10"}
                  value={penThickness}
                  onChange={(e) => setPenThickness(Number(e.target.value))}
                  className="w-16 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-[#D44E3D]"
                />
                <span className="text-[10px] font-mono text-stone-300 w-4">{penThickness}px</span>
              </div>

              {/* Clear button */}
              <button
                onClick={() => {
                  if (confirm('Deseja limpar todos os rabiscos e anotações desenhados neste resumo?')) {
                    window.dispatchEvent(new CustomEvent('clear-smart-pen-drawings', { detail: { topicId: topic.id } }));
                  }
                }}
                className="text-[9px] font-extrabold uppercase tracking-widest text-red-400 hover:text-red-500 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/15"
              >
                Limpar
              </button>

              {/* Cancel drawing Mode */}
              <button
                onClick={() => setIsPenModeActive(false)}
                className="text-[9px] font-extrabold uppercase tracking-widest text-[#FBFBFA]/60 hover:text-white"
              >
                Fechar
              </button>
            </div>
          )}

          {/* FLOATING TEXT SELECTION TOOLBAR */}
          {selectionRangeCoords && selectedText.length > 1 && (
            <div 
              style={{ 
                position: 'fixed', 
                left: `${selectionRangeCoords.x}px`, 
                top: `${selectionRangeCoords.y}px`,
                transform: 'translateX(-50%)',
                zIndex: 10000
              }}
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              className="selection-toolbar bg-[#1A1A1A] border border-stone-800 text-white rounded-xl shadow-2xl py-1 px-2.5 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-150 select-none"
            >
              <div className="flex items-center gap-1.5 border-r border-[#E2E0D9]/20 pr-2.5">
                {[
                  { name: 'Amarelo', hex: '#FEF08A' },
                  { name: 'Verde', hex: '#BBF7D0' },
                  { name: 'Rosa', hex: '#FECDD3' },
                  { name: 'Azul', hex: '#BFDBFE' },
                  { name: 'Roxo', hex: '#E9D5FF' },
                  { name: 'Laranja', hex: '#FED7AA' },
                  { name: 'Tiffany', hex: '#99F6E4' },
                ].map((color) => (
                  <button
                    key={color.name}
                    onClick={() => applyHighlight(color.hex)}
                    style={{ backgroundColor: color.hex }}
                    className="w-5 h-5 rounded-full hover:scale-110 active:scale-95 transition-all shadow-sm border border-black/15 cursor-pointer"
                    title={`Grifar com ${color.name}`}
                  />
                ))}
              </div>

              <button
                onClick={handleSaveClippingPopup}
                className="hover:text-[#D44E3D] font-bold text-[10px] uppercase tracking-widest text-[#FBFBFA] flex items-center gap-1.5 h-8 transition-colors px-1"
                title="Salvar como recorte"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#D44E3D] fill-current" />
                Salvar Recorte
              </button>

              <button
                onClick={() => handleOpenIllustrationSearchModal(selectedText.trim())}
                className="hover:text-amber-400 font-bold text-[10px] uppercase tracking-widest text-[#FBFBFA] flex items-center gap-1.5 h-8 transition-colors px-1"
                title="Pesquisar fotos, livros ou artigos científicos para o termo selecionado"
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                Pedir Foto
              </button>

              <button
                onClick={() => clearSelection()}
                className="text-stone-400 hover:text-white font-bold text-[9px] uppercase tracking-widest h-8 transition-colors pl-1"
                title="Cancelar seleção"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* EXCLUSIVE HIGHLIGHT NOTES + SMART PEN MODAL */}
          {selectedHighlightForNote && (
            <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-[99999] select-none text-stone-800">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white border border-[#E2E0D9] shadow-2xl rounded-2xl p-6 max-w-4xl w-full relative max-h-[90vh] overflow-y-auto"
              >
                <button 
                  onClick={() => handleSaveHighlightNote(highlightNoteText)}
                  className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Salvar e fechar"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2.5 border-b border-[#E2E0D9] pb-4 mb-5">
                  <span 
                    className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                    style={{ backgroundColor: selectedHighlightForNote.color }} 
                  />
                  <div>
                    <h3 className="font-display font-extrabold text-[#1A1A1A] text-xs uppercase tracking-widest">Caderno de Notas do Grifo</h3>
                    <p className="text-[10px] text-[#8E8A82] uppercase tracking-wider font-bold">Escreva mnemônicos e utilize a caneta para rascunhar exclusivamente sobre esta citação</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                  {/* LEFT COLUMN: Quote details and structured text writing block */}
                  <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase tracking-widest font-extrabold text-stone-400 font-mono">Texto Grifado:</span>
                      <div className="bg-[#FBFBFA] border border-[#E2E0D9]/50 p-4 rounded-xl text-xs italic font-sans text-stone-800 leading-relaxed border-l-4 border-l-[#D44E3D]/75 shadow-inner select-text max-h-36 overflow-y-auto">
                        "{selectedHighlightForNote.text}"
                      </div>
                    </div>

                    <div className="space-y-2 flex-grow flex flex-col">
                      <label className="text-[10px] uppercase tracking-wider font-extrabold text-[#1A1A1A] block font-mono">Anotações do Aluno (Digitar):</label>
                      <textarea
                        value={highlightNoteText}
                        onChange={(e) => setHighlightNoteText(e.target.value)}
                        placeholder="Digite aqui observações clínicas, resumos ou mnemônicos rápidos sobre esta citação..."
                        className="w-full min-h-[140px] p-3 border border-[#E2E0D9] rounded-xl text-xs font-sans leading-relaxed text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#D44E3D] focus:border-[#D44E3D] flex-grow shadow-inner resize-none bg-stone-50"
                      />
                    </div>

                    {(() => {
                      const key = userId ? `smart_pen_drawings_${userId}_highlight_${selectedHighlightForNote.id}` : `smart_pen_drawings_highlight_${selectedHighlightForNote.id}`;
                      const hasStrokes = (() => {
                        try {
                          const saved = safeLocalStorageGet(key);
                          return saved ? JSON.parse(saved).length > 0 : false;
                        } catch {
                          return false;
                        }
                      })();
                      return (
                        <button
                          type="button"
                          onClick={() => handleDeepenNotebookItem(selectedHighlightForNote, 'highlight')}
                          className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold text-[10px] uppercase tracking-widest h-11 px-4 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm border border-amber-600/10 cursor-pointer"
                        >
                          <Brain className="w-4 h-4 text-white animate-pulse" />
                          <span>
                            {hasStrokes 
                              ? 'Aprofundar Texto + Grafite com IA (5cr)' 
                              : 'Aprofundar com Preceptor IA (3cr)'}
                          </span>
                        </button>
                      );
                    })()}

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => {
                          const confirmRemove = confirm('Deseja excluir este grifo definitivamente? Seus textos digitados e rabiscos da caneta serão excluídos.');
                          if (confirmRemove) {
                            removeHighlight(selectedHighlightForNote.id);
                            setSelectedHighlightForNote(null);
                          }
                        }}
                        className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/60 font-bold text-[10px] uppercase tracking-widest h-10 px-4 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        Remover Grifo
                      </button>
                      <div className="flex-grow" />
                      <button
                        onClick={() => handleSaveHighlightNote(highlightNoteText)}
                        className="bg-[#D44E3D] hover:bg-[#B83C2C] text-white font-extrabold text-[10px] uppercase tracking-widest h-10 px-5 rounded-xl cursor-pointer transition-all shadow-sm"
                      >
                        Salvar e Fechar
                      </button>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Dedicated Smart Pen handwriting pad for this highlight! */}
                  <div className="flex flex-col border border-[#E2E0D9] rounded-2xl bg-slate-50 relative overflow-hidden min-h-[350px] shadow-sm select-none">
                    <div className="bg-[#F4F2EE] border-b border-[#E2E0D9] px-4 py-2.5 flex items-center justify-between shrink-0 font-sans">
                      <div className="flex items-center gap-1.5">
                        <PenTool className="w-3.5 h-3.5 text-[#D44E3D]" />
                        <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#1A1A1A]">Pequeno Bloco de Escrita de Apoio</span>
                      </div>
                      <button
                        onClick={() => {
                          const event = new CustomEvent('clear-smart-pen-drawings', {
                            detail: { topicId: `highlight_${selectedHighlightForNote.id}` }
                          });
                          window.dispatchEvent(event);
                        }}
                        className="text-[9px] font-bold text-gray-500 hover:text-red-700 uppercase tracking-wider bg-white border border-gray-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                        title="Limpar desenhos do grifo"
                      >
                        Limpar Rabisco
                      </button>
                    </div>

                    {/* Handwriting Stage area */}
                    <div 
                      ref={highlightPenRef} 
                      className="relative w-full flex-grow bg-white cursor-crosshair min-h-[220px]"
                    >
                      <span className="absolute bottom-3 right-3 text-[9px] pointer-events-none text-stone-300 font-bold uppercase tracking-wider font-mono">
                        Rascunho de Citação
                      </span>
                      <SmartPenCanvas
                        topicId={`highlight_${selectedHighlightForNote.id}`}
                        isPenModeActive={true}
                        penColor="#1A1A1A" // Dark black ink by default
                        penThickness={2.5}  // Fine line
                        brushType="pen"
                        containerRef={highlightPenRef}
                        userId={userId}
                        isVisible={true}
                      />
                    </div>
                    <div className="bg-[#F4F2EE] border-t border-[#E2E0D9] px-4 py-2 text-[9px] text-[#8E8A82] font-semibold text-center italic shrink-0 font-sans">
                      Rabisque, monte gráficos ou faça diagramas exclusivos para guardar neste grifo específico.
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* SAVING CLIPPING MODAL */}
          {showClippingModal && (
            <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] select-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white border border-[#E2E0D9] shadow-2xl rounded-2xl p-6 max-w-md w-full relative"
              >
                <button 
                  onClick={() => setShowClippingModal(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 border-b border-[#E2E0D9] pb-4 mb-5">
                  <Bookmark className="w-5 h-5 text-[#D44E3D]" />
                  <div>
                    <h3 className="font-display font-extrabold text-xs uppercase tracking-widest text-[#1A1A1A]">Indexar Recorte Médico</h3>
                    <p className="text-[10px] text-[#8E8A82] uppercase tracking-wider font-bold">Classifique para estudar depois no caderno</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="bg-[#FBFBFA] border border-[#E2E0D9]/60 p-3.5 rounded-xl text-xs italic font-sans text-gray-800 leading-relaxed max-h-32 overflow-y-auto border-l-4 border-l-[#D44E3D]/50 bg-stone-50 select-text">
                    "{clippingToSave}"
                  </div>

                  <label className="text-[10px] uppercase tracking-wider font-extrabold text-[#1A1A1A] block font-mono">Selecione o Índice de Destino:</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {CLIPPING_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => saveClipping(cat.id)}
                        className="p-3 text-left border border-[#E2E0D9] hover:border-[#D44E3D]/40 hover:bg-[#D44E3D]/[0.02] active:bg-[#D44E3D]/[0.05] rounded-xl text-[11px] font-bold text-gray-800 flex items-center gap-2 transition-all group cursor-pointer"
                      >
                        <span className="group-hover:scale-110 transition-transform">{cat.label.split(' ')[0]}</span>
                        <span className="truncate">{cat.label.split(' ').slice(1).join(' ')}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-[#E2E0D9] gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowClippingModal(false)}
                    className="text-[10px] uppercase tracking-widest font-black h-10 px-4 rounded-xl"
                  >
                    Cancelar
                  </Button>
                </div>
              </motion.div>
            </div>
          )}

          {/* NOTEBOOK AI DEEPENING PROGRESS OVERLAY */}
          {isDeepeningItem && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[999999] select-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border border-[#E2E0D9] shadow-2xl rounded-2xl p-8 max-w-sm w-full text-center space-y-5"
              >
                <div className="relative flex justify-center">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl w-16 h-16 mx-auto animate-pulse" />
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-full relative">
                    <Brain className="w-8 h-8 text-amber-500 animate-spin animate-duration-3000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-display font-extrabold text-[#1A1A1A] text-sm uppercase tracking-widest">Consultando o Preceptor...</h4>
                  <p className="text-[11px] text-[#8E8A82] leading-relaxed">
                    Analisando o trecho selecionado, suas anotações de estudo e traços grafites para estruturar uma explicação completa e robusta...
                  </p>
                </div>

                {/* DYNAMIC SECONDS PROGRESS ESTIMATOR */}
                <div className="space-y-3 pt-2">
                  <div className="w-full bg-[#E2E0D9] h-1.5 rounded-full overflow-hidden relative">
                    <motion.div 
                      className="bg-amber-500 h-full rounded-full"
                      initial={{ width: "100%" }}
                      animate={{ width: `${(deepeningSecondsRemaining / 25) * 100}%` }}
                      transition={{ duration: 1, ease: "linear" }}
                    />
                  </div>
                  <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest select-none">
                    Previsão de conclusão: ~ {deepeningSecondsRemaining}s restantes
                  </div>
                </div>

                <div className="flex justify-center items-center gap-1.5 text-[9px] uppercase tracking-wider font-extrabold text-[#8E8A82] bg-stone-100/80 border border-stone-200 px-3 py-1.5 rounded-full w-fit mx-auto">
                  <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                  Conexão ativa com o Gemini 3.5
                </div>
              </motion.div>
            </div>
          )}

          {/* NOTEBOOK AI DEEPENED RESULT MODAL */}
          {deepenedItemResult && (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[999999] select-none text-stone-800 font-sans">
              <motion.div 
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white border border-[#E2E0D9] shadow-2xl rounded-2xl p-6 max-w-3xl w-full relative max-h-[92vh] flex flex-col overflow-hidden"
              >
                <button 
                  onClick={() => setDeepenedItemResult(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2.5 border-b border-[#E2E0D9] pb-4 mb-4 shrink-0">
                  <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl text-amber-600">
                    <Brain className="w-5 h-5 animate-pulse text-[#D44E3D]" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-[#1A1A1A] text-xs uppercase tracking-widest">Aprofundamento Recomendado pelo Preceptor</h3>
                    <p className="text-[10px] text-[#8E8A82] uppercase tracking-wider font-bold">Conteúdo clínico especializado associado ao seu caderno de estudos</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin select-text py-2">
                  <div className="space-y-1.5 shrink-0">
                    <span className="text-[9px] uppercase tracking-widest font-extrabold text-stone-400 font-mono">Trecho Analisado:</span>
                    <div className="bg-[#FBFBFA] border border-[#E2E0D9]/50 p-3.5 rounded-xl text-xs italic font-sans text-stone-800 leading-relaxed border-l-4 border-l-amber-500/75 shadow-inner">
                      "{deepenedItemResult.itemText}"
                    </div>
                  </div>

                  {deepenedItemResult.noteUsed && (
                    <div className="space-y-1 shrink-0">
                      <span className="text-[9px] uppercase tracking-widest font-extrabold text-stone-400 font-mono">Suas Anotações Próprias Integradas:</span>
                      <p className="text-[11px] text-stone-600 bg-stone-50 border border-stone-200/50 p-2.5 rounded-xl font-sans italic">
                        "{deepenedItemResult.noteUsed}"
                      </p>
                    </div>
                  )}

                  {deepenedItemResult.hasDrawingUsed && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200/60 rounded-xl text-[10px] text-[#2E7D32] font-semibold w-fit shrink-0">
                      <PenTool className="w-3.5 h-3.5 text-green-600 animate-bounce" />
                      Anotação de caneta gráfica ("grafite") foi processada e incorporada à análise!
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="text-[9px] uppercase tracking-widest font-extrabold text-stone-400 font-mono block">Ementa Complementar Clínica:</span>
                    <div className="bg-stone-50 border border-[#E2E0D9] p-5 rounded-2xl leading-relaxed text-sm shadow-inner prose prose-stone max-w-none text-stone-800 font-sans pr-2">
                      <div className="markdown-body select-text">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]} 
                          rehypePlugins={[rehypeRaw, rehypeKatex]}
                          components={markdownComponents}
                        >
                          {deepenedItemResult.text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#E2E0D9] pt-4 mt-4 shrink-0 flex flex-col sm:flex-row gap-3 items-center">
                  <button
                    onClick={handleSaveAItoAnnotation}
                    className="w-full sm:w-1/2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] uppercase tracking-widest h-11 px-4 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <BookOpen className="w-4 h-4 text-white" />
                    Salvar na Nota do Caderno
                  </button>
                  <button
                    onClick={handleSaveAItoSummary}
                    className="w-full sm:w-1/2 bg-[#1A1A1A] hover:bg-black text-white font-extrabold text-[10px] uppercase tracking-widest h-11 px-4 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <FileText className="w-4 h-4 text-white" />
                    Mesclar ao Resumo Principal
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* SOPHISTICATED ILLUSTRATION & SCIENTIFIC BOOK SEARCH POPUP */}
          {showIllustrationSearchModal && (
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 z-[99999] select-auto text-stone-800 font-sans"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="bg-white border border-[#E2E0D9] shadow-2xl rounded-2xl md:rounded-3xl p-4 md:p-6 max-w-7xl w-full relative flex flex-col h-[92vh] md:h-[90vh] overflow-hidden"
              >
                {/* Close Button */}
                <button
                  onClick={() => setShowIllustrationSearchModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer z-30"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Top Header & Step Navigation */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E2E0D9] pb-3 mb-3 shrink-0 pr-10">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-2.5 rounded-2xl text-white shadow-md shadow-amber-500/20">
                      <BookOpen className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-black text-stone-900 text-sm md:text-base uppercase tracking-wider">
                          {searchModalReplacingId ? "Substituir Ilustração Médica" : "Acervo de Ilustrações Médicas & Manuais"}
                        </h3>
                        <span className="bg-amber-100 text-amber-900 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-amber-300">
                          FEBRASGO • PCDT • MS • Harrison
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 font-medium leading-tight mt-0.5">
                        {modalStep === 'select_image' 
                          ? "Pesquise e selecione a melhor ilustração médica para o seu estudo."
                          : "Escolha exatamente abaixo de qual subtítulo do seu resumo a imagem será anexada."}
                      </p>
                    </div>
                  </div>

                  {/* Step Pills */}
                  <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl border border-[#E2E0D9] shrink-0 self-start md:self-auto">
                    <button
                      type="button"
                      onClick={() => setModalStep('select_image')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                        modalStep === 'select_image'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[9px]">1</span>
                      <span>1. Escolher Imagem</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (searchModalSelectedId) setModalStep('select_location');
                      }}
                      disabled={!searchModalSelectedId}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                        modalStep === 'select_location'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : searchModalSelectedId
                          ? 'text-stone-700 hover:bg-stone-200 cursor-pointer'
                          : 'text-stone-400 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[9px]">2</span>
                      <span>2. Definir Posição</span>
                    </button>
                  </div>
                </div>

                {/* STEP 1: SEARCH & GALLERY */}
                {modalStep === 'select_image' && (
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-3">
                    {/* Search Bar & Sourcing Filters */}
                    <div className="bg-stone-50/90 border border-[#E2E0D9]/80 p-3 rounded-2xl shrink-0 space-y-2">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input
                            type="text"
                            value={searchModalQuery}
                            onChange={(e) => setSearchModalQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSearchScientificImages(searchModalQuery);
                            }}
                            placeholder="Ex: corrimento vaginal, sinal de Murphy, carcinoma ductal, herpes genital..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-[#E2E0D9] rounded-xl text-xs font-semibold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all shadow-sm"
                          />
                        </div>
                        <button
                          onClick={() => handleSearchScientificImages(searchModalQuery, false)}
                          className="bg-white hover:bg-stone-100 active:bg-stone-200 text-stone-700 font-bold text-[10px] uppercase tracking-widest px-3.5 py-2 rounded-xl transition-all border border-[#E2E0D9] shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Search className="w-3.5 h-3.5" />
                          Pesquisar
                        </button>
                        <button
                          onClick={() => handleSearchScientificImages(searchModalQuery, true)}
                          disabled={(globalQuota?.available ?? 0) < 1 || searchModalAiLoading}
                          className={`${(globalQuota?.available ?? 0) >= 1 ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md shadow-indigo-200' : 'bg-stone-300'} text-white font-extrabold text-[10px] uppercase tracking-widest px-3.5 py-2 rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed`}
                          title={(globalQuota?.available ?? 0) >= 1 ? "Custo: 1 crédito de IA." : "Créditos insuficientes"}
                        >
                          {searchModalAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Otimizar com IA (1cr)
                        </button>
                      </div>

                      <div className="flex items-center justify-between flex-wrap gap-2 pt-1.5 border-t border-[#E2E0D9]/50 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="uppercase tracking-wider font-extrabold text-stone-400 font-mono text-[9px]">Fontes:</span>
                          <button
                            onClick={() => {
                              const next = !searchModalSourceBooks;
                              if (!next && !searchModalSourceArticles) return;
                              setSearchModalSourceBooks(next);
                              setTimeout(() => handleSearchScientificImages(searchModalQuery), 50);
                            }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              searchModalSourceBooks 
                                ? 'bg-amber-100/80 border-amber-300 text-amber-900 shadow-sm' 
                                : 'bg-white border-[#E2E0D9] text-stone-400 hover:text-stone-600'
                            }`}
                          >
                            <BookOpen className="w-3 h-3" />
                            Manuais e Livros
                          </button>
                          <button
                            onClick={() => {
                              const next = !searchModalSourceArticles;
                              if (!next && !searchModalSourceBooks) return;
                              setSearchModalSourceArticles(next);
                              setTimeout(() => handleSearchScientificImages(searchModalQuery), 50);
                            }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              searchModalSourceArticles 
                                ? 'bg-emerald-100/80 border-emerald-300 text-emerald-900 shadow-sm' 
                                : 'bg-white border-[#E2E0D9] text-stone-400 hover:text-stone-600'
                            }`}
                          >
                            <FileText className="w-3 h-3" />
                            Artigos Científicos
                          </button>
                        </div>

                        <div className="flex items-center gap-1 text-indigo-700 font-semibold text-[10px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Acervo Verificado</span>
                        </div>
                      </div>
                    </div>

                    {/* Split View for Step 1 */}
                    <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden">
                      {searchModalLoading ? (
                        <div className="col-span-12 flex flex-col items-center justify-center py-16 space-y-4">
                          <div className="relative">
                            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl w-16 h-16 mx-auto animate-pulse" />
                            <Loader2 className="w-10 h-10 text-amber-600 animate-spin relative z-10" />
                          </div>
                          <div className="text-center space-y-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-stone-700">
                              {searchModalAiLoading ? "Analisando termos técnicos de saúde com IA..." : "Consultando Manuais, FEBRASGO, PCDT e Repositórios..."}
                            </p>
                            <p className="text-[10px] text-stone-400 font-mono">
                              Buscando ilustrações diagnósticas em coleções científicas
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Results List (5 cols) */}
                          <div className="col-span-12 md:col-span-5 flex flex-col min-h-0 min-w-0 border-b md:border-b-0 md:border-r border-[#E2E0D9] pb-2 md:pb-0 md:pr-3">
                            <div className="flex items-center justify-between mb-2 shrink-0">
                              <span className="text-[9px] uppercase tracking-widest font-extrabold text-stone-400 font-mono">
                                Resultados ({searchModalResults.length})
                              </span>
                              {searchModalResults.length > 0 && (
                                <span className="text-[9px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  Clique para selecionar
                                </span>
                              )}
                            </div>
                            
                            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0 scrollbar-thin">
                              {searchModalResults.length === 0 ? (
                                <div className="text-center py-12 px-4 text-stone-400 border border-dashed border-[#E2E0D9] rounded-2xl bg-stone-50/50 flex flex-col items-center gap-3">
                                  <ImageOff className="w-8 h-8 text-stone-300" />
                                  <div>
                                    <p className="text-xs font-bold text-stone-700 uppercase tracking-tight">Nenhuma imagem encontrada para "{searchModalQuery}"</p>
                                    <p className="text-[10px] text-stone-500 mt-2 leading-relaxed">
                                      Dica: Utilize o botão <strong className="text-indigo-600">"Otimizar com IA"</strong> para converter o nome da manifestação clínica em termos específicos de atlas.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                searchModalResults.map((item, mapIdx) => {
                                  const isSelected = item.id === searchModalSelectedId;
                                  return (
                                    <button
                                      key={`sm-res-${item.id || item.url || mapIdx}-${mapIdx}`}
                                      onClick={() => setSearchModalSelectedId(item.id)}
                                      onDoubleClick={() => {
                                        setSearchModalSelectedId(item.id);
                                        setModalStep('select_location');
                                      }}
                                      className={`w-full text-left p-2.5 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                                        isSelected
                                          ? 'bg-amber-50/80 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                                          : 'bg-white border-[#E2E0D9] hover:border-amber-400 hover:bg-amber-50/20'
                                      }`}
                                    >
                                      {/* Thumbnail */}
                                      <div className="w-16 h-20 bg-stone-100 rounded-xl overflow-hidden shrink-0 border border-[#E2E0D9]/80 flex items-center justify-center relative shadow-sm">
                                        <div className="absolute inset-0 flex items-center justify-center z-0">
                                          <BookOpen className="w-5 h-5 text-stone-300/60" />
                                        </div>
                                        <img
                                          src={getProxyImageUrl(item.thumbUrl || item.url)}
                                          alt={item.title}
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover z-10"
                                          loading="lazy"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            if (target.src.includes('/api/proxy-image') && (item.thumbUrl || item.url)) {
                                              target.src = item.thumbUrl || item.url;
                                            } else {
                                              target.style.display = 'none';
                                            }
                                          }}
                                        />
                                        {isSelected && (
                                          <div className="absolute top-1 right-1 bg-amber-500 text-white p-1 rounded-full shadow">
                                            <Check className="w-2.5 h-2.5" />
                                          </div>
                                        )}
                                      </div>

                                      {/* Info */}
                                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                        <div>
                                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                            {item.sourceType === 'book' ? (
                                              <span className="text-[8px] bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded-md font-extrabold uppercase tracking-wider">
                                                Manual / Livro
                                              </span>
                                            ) : (
                                              <span className="text-[8px] bg-emerald-100 text-emerald-900 border border-emerald-200 px-1.5 py-0.2 rounded-md font-extrabold uppercase tracking-wider">
                                                Artigo
                                              </span>
                                            )}
                                            {item.specialty && (
                                              <span className="text-[8px] bg-stone-100 text-stone-600 border border-stone-200 px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider truncate max-w-[120px]">
                                                {item.specialty}
                                              </span>
                                            )}
                                          </div>
                                          <h4 className="font-sans font-bold text-xs text-stone-900 leading-snug line-clamp-2">
                                            {item.title}
                                          </h4>
                                        </div>
                                        <p className="text-[10px] text-stone-500 font-medium truncate mt-1">
                                          Fonte: {item.sourceName}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Selected Image Preview & Next Step Button (7 cols) */}
                          <div className="col-span-12 md:col-span-7 flex flex-col min-h-0 min-w-0 overflow-y-auto pr-1 space-y-3.5 scrollbar-thin">
                            <span className="text-[9px] uppercase tracking-widest font-extrabold text-stone-400 font-mono block shrink-0">
                              Pré-visualização da Imagem
                            </span>

                            {(() => {
                              const selectedItem = searchModalResults.find(r => r.id === searchModalSelectedId);
                              if (!selectedItem) {
                                return (
                                  <div className="flex-1 bg-stone-50/60 border border-dashed border-[#E2E0D9] rounded-2xl flex flex-col items-center justify-center p-6 text-center text-stone-400 min-h-[250px]">
                                    <BookOpen className="w-10 h-10 opacity-30 mb-2.5 text-stone-400" />
                                    <p className="text-xs font-bold text-stone-600">Nenhuma imagem selecionada</p>
                                    <p className="text-[10px] text-stone-400 mt-1 max-w-xs">
                                      Clique em qualquer resultado à esquerda para pré-visualizar a ilustração e avançar para o posicionamento no texto.
                                    </p>
                                  </div>
                                );
                              }

                              return (
                                <>
                                  {/* High-Res Image Display */}
                                  <div className="bg-stone-950 rounded-2xl overflow-hidden border border-stone-800 flex items-center justify-center p-3 relative group min-h-[200px] max-h-[340px] shadow-lg shrink-0">
                                    <img
                                      src={getProxyImageUrl(selectedItem.url)}
                                      alt={selectedItem.title}
                                      referrerPolicy="no-referrer"
                                      className="max-w-full max-h-[310px] object-contain rounded-lg shadow-2xl z-10"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        if (target.src.includes('/api/proxy-image') && selectedItem.url) {
                                          target.src = selectedItem.url;
                                        } else {
                                          target.style.display = 'none';
                                        }
                                      }}
                                    />
                                    <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] text-amber-300 font-mono uppercase tracking-widest border border-amber-500/30">
                                      {selectedItem.sourceType === 'book' ? "Manual Bibliográfico" : "Acervo Científico"}
                                    </div>
                                  </div>

                                  {/* Citation Information Card */}
                                  <div className="bg-stone-50 border border-[#E2E0D9] rounded-2xl p-3.5 space-y-1.5 text-xs shadow-sm shrink-0">
                                    <div className="flex items-center gap-1.5">
                                      <Award className="w-4 h-4 text-amber-500 shrink-0" />
                                      <span className="font-mono text-[9px] uppercase tracking-widest font-black text-amber-800">
                                        Fonte e Referência Médica
                                      </span>
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="font-extrabold text-stone-900 text-xs leading-snug">
                                        {selectedItem.title}
                                      </p>
                                      <p className="text-stone-600 font-medium text-[11px]">
                                        <strong className="text-stone-800">Origem:</strong> {selectedItem.sourceName}
                                      </p>
                                      {selectedItem.authors && (
                                        <p className="text-stone-500 text-[10px]">
                                          <strong className="text-stone-700">Autor / Conselho:</strong> {selectedItem.authors}
                                        </p>
                                      )}
                                      {selectedItem.caption && (
                                        <p className="text-stone-600 text-[10px] leading-relaxed italic border-t border-[#E2E0D9] pt-1.5 mt-1">
                                          "{selectedItem.caption}"
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Advance to Step 2 Button */}
                                  <button
                                    onClick={() => setModalStep('select_location')}
                                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.99] text-white font-black text-xs uppercase tracking-widest h-12 rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 shrink-0"
                                  >
                                    <span>Avançar: Escolher Posição no Resumo</span>
                                    <ArrowRight className="w-4 h-4" />
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 2: POSITIONING IN SUMMARY (SINGLE FLUID SCROLL CONTAINER) */}
                {modalStep === 'select_location' && (
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {(() => {
                      const selectedItem = searchModalResults.find(r => r.id === searchModalSelectedId);
                      if (!selectedItem) {
                        return (
                          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-stone-400">
                            <p className="text-xs font-bold">Por favor, volte para a etapa 1 e selecione uma imagem.</p>
                            <button
                              onClick={() => setModalStep('select_image')}
                              className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-xs"
                            >
                              ← Voltar para Galeria
                            </button>
                          </div>
                        );
                      }

                      const { sections, defaultSectionId, defaultHeadingText } = getTopicSectionsAndDefault(currentContent || '', searchModalQuery || selectedItem.title);
                      const activeSecId = selectedInsertionSectionId === 'auto' ? defaultSectionId : selectedInsertionSectionId;
                      let chosenHeadingText = defaultHeadingText;

                      if (activeSecId === 'end') {
                        chosenHeadingText = 'Final de todo o capítulo / resumo';
                      } else {
                        const s = sections.find(item => item.id === activeSecId);
                        if (s) chosenHeadingText = s.headingText;
                      }

                      return (
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                          {/* Selected Image Banner Bar */}
                          <div className="bg-stone-50 border border-[#E2E0D9] rounded-2xl p-3 flex items-center justify-between gap-3 shrink-0 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 bg-stone-950 rounded-xl overflow-hidden shrink-0 border border-amber-300 flex items-center justify-center">
                                <img
                                  src={getProxyImageUrl(selectedItem.url)}
                                  alt={selectedItem.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[8px] font-mono uppercase tracking-widest font-black text-amber-800 bg-amber-100 px-2 py-0.2 rounded">
                                  Imagem Selecionada
                                </span>
                                <h4 className="font-bold text-stone-900 text-xs truncate mt-0.5">
                                  {selectedItem.title}
                                </h4>
                                <p className="text-[10px] text-stone-500 truncate">
                                  Fonte: {selectedItem.sourceName}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setModalStep('select_image')}
                              className="text-stone-600 hover:text-stone-900 font-bold text-[10px] uppercase tracking-wider bg-white border border-[#E2E0D9] hover:bg-stone-100 px-3 py-2 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              <span>Trocar Imagem</span>
                            </button>
                          </div>

                          {/* MAIN SINGLE UNCONSTRAINED SCROLL VIEWPORT FOR LOCATION SELECTION & DOCUMENT SIMULATOR */}
                          <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 pb-2 scrollbar-thin">
                            {/* SECTION LOCATION PICKER */}
                            <div className="bg-gradient-to-b from-stone-900 to-stone-950 text-stone-100 border border-stone-800 rounded-2xl p-4 md:p-5 space-y-3.5 shadow-xl relative overflow-hidden">
                              <div className="flex items-center justify-between gap-3 border-b border-stone-800 pb-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="bg-amber-500/20 text-amber-400 p-2 rounded-xl border border-amber-500/30">
                                    <MapPin className="w-4 h-4 animate-bounce" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                                      Onde deseja posicionar a ilustração?
                                    </h4>
                                    <p className="text-[10px] text-stone-400 font-medium">
                                      Selecione o subtítulo do seu resumo. A imagem será anexada logo após o trecho selecionado.
                                    </p>
                                  </div>
                                </div>

                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0">
                                  {selectedInsertionSectionId === 'auto' ? 'Sugerido por IA' : 'Posição Customizada'}
                                </span>
                              </div>

                              {/* Interactive Section Selector Cards */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedInsertionSectionId('auto')}
                                  className={`p-3 rounded-xl text-left transition-all border cursor-pointer flex flex-col justify-between space-y-1.5 ${
                                    selectedInsertionSectionId === 'auto'
                                      ? 'bg-amber-500 text-stone-950 border-amber-400 font-black shadow-lg shadow-amber-500/20'
                                      : 'bg-stone-800/80 hover:bg-stone-700/80 text-stone-200 border-stone-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[8px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                      selectedInsertionSectionId === 'auto' ? 'bg-stone-950 text-amber-300' : 'bg-amber-500/20 text-amber-300'
                                    }`}>
                                      ✨ Recomendado
                                    </span>
                                    {selectedInsertionSectionId === 'auto' && <Check className="w-4 h-4 text-stone-950" />}
                                  </div>
                                  <p className="text-xs font-bold leading-tight line-clamp-2">
                                    Abaixo de "{defaultHeadingText}"
                                  </p>
                                </button>

                                {sections.map(sec => {
                                  const isSecSelected = selectedInsertionSectionId === sec.id;
                                  const levelLabel = sec.level === 1 ? 'Seção Principal' : sec.level === 2 ? 'Subtítulo' : 'Subtópico';
                                  return (
                                    <button
                                      key={`chip-${sec.id}`}
                                      type="button"
                                      onClick={() => setSelectedInsertionSectionId(sec.id)}
                                      className={`p-3 rounded-xl text-left transition-all border cursor-pointer flex flex-col justify-between space-y-1.5 ${
                                        isSecSelected
                                          ? 'bg-amber-500 text-stone-950 border-amber-400 font-black shadow-lg shadow-amber-500/20'
                                          : 'bg-stone-800/80 hover:bg-stone-700/80 text-stone-200 border-stone-700'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className={`text-[8px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                          isSecSelected ? 'bg-stone-950 text-amber-300' : 'bg-stone-900 text-stone-400 border border-stone-700'
                                        }`}>
                                          📌 {levelLabel}
                                        </span>
                                        {isSecSelected && <Check className="w-4 h-4 text-stone-950" />}
                                      </div>
                                      <p className="text-xs font-bold leading-tight line-clamp-2">
                                        Abaixo de "{sec.headingText}"
                                      </p>
                                    </button>
                                  );
                                })}

                                <button
                                  type="button"
                                  onClick={() => setSelectedInsertionSectionId('end')}
                                  className={`p-3 rounded-xl text-left transition-all border cursor-pointer flex flex-col justify-between space-y-1.5 ${
                                    selectedInsertionSectionId === 'end'
                                      ? 'bg-amber-500 text-stone-950 border-amber-400 font-black shadow-lg shadow-amber-500/20'
                                      : 'bg-stone-800/80 hover:bg-stone-700/80 text-stone-200 border-stone-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[8px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                      selectedInsertionSectionId === 'end' ? 'bg-stone-950 text-amber-300' : 'bg-stone-900 text-stone-400 border border-stone-700'
                                    }`}>
                                      📄 Final
                                    </span>
                                    {selectedInsertionSectionId === 'end' && <Check className="w-4 h-4 text-stone-950" />}
                                  </div>
                                  <p className="text-xs font-bold leading-tight">
                                    No final de todo o capítulo / resumo
                                  </p>
                                </button>
                              </div>
                            </div>

                            {/* DOCUMENT SIMULATOR VISOR */}
                            <div className="bg-[#FAF9F5] text-stone-900 rounded-2xl p-4 border-2 border-amber-300 shadow-xl space-y-3">
                              <div className="flex items-center justify-between border-b border-stone-300 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-stone-700 flex items-center gap-1.5">
                                    <Eye className="w-3.5 h-3.5 text-amber-700" />
                                    Simulação do Resumo com a Imagem
                                  </span>
                                </div>
                                <span className="text-[9px] bg-amber-100 text-amber-950 font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border border-amber-300">
                                  Posição: {chosenHeadingText}
                                </span>
                              </div>

                              <div className="font-serif space-y-2 text-stone-800 text-xs">
                                <p className="text-stone-400 text-[11px] italic font-sans border-b border-stone-200 pb-1.5">
                                  "...trecho anterior do seu resumo médico contendo a fundamentação fisiopatológica..."
                                </p>
                                
                                <h4 className="font-sans font-black text-stone-900 text-sm uppercase tracking-wide text-amber-900 pt-1">
                                  {chosenHeadingText}
                                </h4>

                                <p className="text-xs text-stone-600 leading-relaxed font-sans">
                                  Conteúdo explicativo do tópico de estudo do estudante...
                                </p>

                                {/* EMBEDDED IMAGE CARD */}
                                <motion.div 
                                  initial={{ scale: 0.98, opacity: 0.9 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="bg-amber-50/95 border-2 border-dashed border-amber-500 rounded-xl p-3 my-2 shadow-md space-y-2"
                                >
                                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-amber-500 text-white p-1 rounded-lg shadow-xs">
                                        <ImageIcon className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-950 font-sans">
                                        Ilustração Científica Anexada Aqui
                                      </span>
                                    </div>
                                    <span className="bg-amber-200/90 text-amber-950 font-mono text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-300">
                                      📍 Posição no Texto
                                    </span>
                                  </div>

                                  <div className="flex gap-3 items-center pt-1">
                                    <div className="w-20 h-20 bg-stone-950 rounded-lg overflow-hidden border border-amber-300 shrink-0 shadow-sm flex items-center justify-center">
                                      <img
                                        src={getProxyImageUrl(selectedItem.url)}
                                        alt={selectedItem.title}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-0.5 font-sans">
                                      <h5 className="font-extrabold text-stone-900 text-xs truncate">
                                        {selectedItem.title}
                                      </h5>
                                      <p className="text-[10px] text-stone-600 line-clamp-2 italic">
                                        {selectedItem.caption || "Figura de referência médica com alta relevância diagnóstica."}
                                      </p>
                                      <div className="text-[9px] font-mono font-extrabold text-amber-900 flex items-center gap-1 pt-0.5">
                                        <span>Fonte: {selectedItem.sourceName}</span>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>

                                <p className="text-[11px] text-stone-500 leading-relaxed font-sans italic opacity-75">
                                  "...continuação dos tópicos de tratamento, conduta clínica e seguimento..."
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* FOOTER CONFIRM BUTTON */}
                          <div className="shrink-0 pt-3 border-t border-[#E2E0D9] flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setModalStep('select_image')}
                              className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <ArrowLeft className="w-4 h-4" />
                              <span>Voltar</span>
                            </button>

                            <button
                              onClick={handleConfirmIllustrationSelection}
                              className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.99] text-white font-black text-xs uppercase tracking-widest h-12 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                            >
                              <Check className="w-4 h-4" />
                              {searchModalReplacingId 
                                ? "Confirmar Substituição da Imagem" 
                                : "Confirmar e Inserir Imagem no Resumo"}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* EXPANDED FULLSCREEN READER MODAL */}
          {isExpandedViewOpen && (
            <motion.div 
              key="fullscreen-reader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-stone-100 z-[9998] flex flex-col h-screen select-none"
            >
              <div className="bg-white border-b border-[#E2E0D9] px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsExpandedViewOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <div>
                    <span className="text-[9px] bg-slate-100 text-[#8E8A82] border border-slate-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Resumo Expandido
                    </span>
                    <h2 className="text-sm font-bold text-[#1A1A1A] leading-tight mt-0.5">{topic.title}</h2>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setShowNotebook(!showNotebook)}
                    className={cn(
                      "text-[10px] uppercase tracking-widest font-bold h-10 px-4 rounded-xl",
                      showNotebook ? "bg-[#D44E3D]/5 text-[#D44E3D] border-[#D44E3D]/20 hover:bg-[#D44E3D]/10" : "bg-white"
                    )}
                  >
                    <Notebook className="w-4 h-4 mr-2" />
                    {showNotebook ? 'Ocultar Caderno' : 'Ver Caderno'}
                  </Button>

                  <Button 
                    onClick={() => setIsExpandedViewOpen(false)}
                    className="bg-[#1A1A1A] hover:bg-black text-white text-[10px] uppercase tracking-widest font-bold h-10 px-5 rounded-xl"
                  >
                    Sair Tela Cheia
                  </Button>
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden min-h-0">
                <div 
                  ref={fullscreenScrollRef}
                  onMouseUp={() => handleTextSelection()}
                  onTouchEnd={() => handleTextSelection()}
                  onClick={handleContentClick}
                  className="flex-1 overflow-y-auto px-8 md:px-16 py-12 bg-white flex justify-center scrollbar-thin select-text"
                >
                  <div className="max-w-4xl w-full select-text pb-20 relative">
                    <SmartPenCanvas 
                      topicId={`${topic.id}_${depth}`}
                      isPenModeActive={isPenModeActive}
                      penColor={penColor}
                      penThickness={penThickness}
                      brushType={penBrushType}
                      containerRef={fullscreenScrollRef}
                      userId={userId}
                      isVisible={showDrawings}
                    />
                    <SummaryDossierHeader 
                      title={topic.title}
                      subjectName={subjects.find(s => s.id === topic.subjectId)?.name}
                      depth={depth}
                      lastUpdated={topic.lastUpdated}
                      wordCount={wordCount}
                      readingTime={readingTime}
                      hideTitle={currentContent.trim().startsWith('# ')}
                    />

                    <div className="markdown-body prose prose-slate max-w-none">
                      {renderedExpandedMarkdown}
                    </div>

                    {showResumeOption && (
                      <div className="mt-8 p-6 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-100/60 flex items-center justify-center shrink-0 border border-amber-200/60">
                            {hasErrorInContent ? (
                              <AlertCircle className="w-5 h-5 text-amber-600" />
                            ) : (
                              <Sparkles className="w-5 h-5 text-amber-600 fill-amber-500/10" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-amber-950">
                              {hasErrorInContent ? 'Geração Interrompida ou com Erros' : 'Opção de Continuar / Retomar Geração'}
                            </h4>
                            <p className="text-xs text-amber-900/85 mt-1 leading-relaxed">
                              {hasErrorInContent 
                                ? 'Alguma seção ou capítulo deste resumo falhou em carregar completamente devido à instabilidade na rede ou limites temporários de cota. Seus créditos do site foram preservados! Clique abaixo para retomar a geração seletiva de onde parou.'
                                : 'Se este resumo parecer incompleto, curto demais ou interrompido no meio por flutuações de rede, você pode clicar abaixo para acionar a continuação inteligente e gerar as seções restantes mantendo o conteúdo atual!'}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={handleResumeAI}
                          disabled={isGenerating}
                          className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-2.5 rounded-xl shadow-md shrink-0 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {hasErrorInContent ? 'Retomar e Concluir' : 'Continuar de onde parou'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {showNotebook && (
                  <div className="w-96 shrink-0 bg-[#FBFBFA] border-l border-[#E2E0D9] overflow-y-auto p-6 scrollbar-thin select-none">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-[#E2E0D9] pb-4">
                        <div className="flex items-center gap-2">
                          <Notebook className="w-4 h-4 text-[#D44E3D]" />
                          <h3 className="text-xs uppercase tracking-widest font-extrabold text-[#1A1A1A]">Meu Caderno</h3>
                        </div>
                        <span className="text-[10px] bg-[#D44E3D]/10 text-[#D44E3D] px-2.5 py-0.5 rounded-full font-bold">
                          {clippings.length} recortes
                        </span>
                      </div>

                      {/* Notebook navigation tabs */}
                      <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200">
                        <button
                          onClick={() => setNotebookTab('notes')}
                          className={cn(
                            "flex-1 text-[10px] font-black uppercase tracking-wider py-2 rounded-lg transition-all",
                            notebookTab === 'notes'
                              ? "bg-white text-[#D44E3D] shadow-sm"
                              : "text-stone-500 hover:text-stone-800"
                          )}
                        >
                          Notas & Grifos
                        </button>
                        <button
                          onClick={() => setNotebookTab('images')}
                          className={cn(
                            "flex-1 text-[10px] font-black uppercase tracking-wider py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
                            notebookTab === 'images'
                              ? "bg-white text-amber-600 shadow-sm"
                              : "text-stone-500 hover:text-stone-800"
                          )}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          Atlas ({illustrations.length})
                        </button>
                      </div>

                      {notebookTab === 'notes' && (
                        <div>
                          {clippings.length === 0 && highlights.length === 0 ? (
                            <div className="text-center py-20 text-[#8E8A82]">
                              <Bookmark className="w-8 h-8 mx-auto mb-3 opacity-25" />
                              <p className="text-xs leading-relaxed font-medium">
                                Selecione trechos do texto para <span className="font-bold underline text-[#D44E3D]/80">grifar</span> ou <span className="font-bold underline text-[#D44E3D]/80">salvar recortes</span> categorizados!
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-5">
                              {CLIPPING_CATEGORIES.map((cat) => {
                                const catClippings = clippings.filter(c => c.category === cat.id);
                                if (catClippings.length === 0) return null;
                                
                                return (
                                  <div key={`notebook-cat-${cat.id}`} className="border border-[#E2E0D9] rounded-xl overflow-hidden bg-white shadow-sm">
                                    <div className="bg-[#F4F2EE] px-3 py-2 text-xs font-bold text-[#1A1A1A] flex justify-between items-center border-b border-[#E2E0D9]">
                                      <span>{cat.label}</span>
                                      <span className="text-[9px] bg-slate-200/80 px-1.5 py-0.2 rounded-full font-bold text-gray-600">
                                        {catClippings.length}
                                      </span>
                                    </div>
                                    <div className="p-2 space-y-2">
                                      {catClippings.map((clip, clipIdx) => (
                                        <div 
                                          key={`notebook-clip-${clip.id}-${clipIdx}`} 
                                          onClick={() => scrollToText(clip.text, undefined, clip.occurrence)}
                                          className="group/clip bg-[#FBFBFA] p-2.5 rounded-lg border border-[#E2E0D9]/60 hover:border-[#D44E3D]/30 hover:bg-[#D44E3D]/[0.02] transition-all text-xs relative cursor-pointer"
                                          title="Clique para rolar até este trecho no resumo"
                                        >
                                          <p className="text-gray-800 leading-relaxed pr-2 font-sans italic">"{clip.text}"</p>
                                          <div className="mt-2 flex items-center justify-between text-[9px] text-[#8E8A82] border-t border-dashed border-[#E2E0D9]/60 pt-1.5">
                                            <span>{new Date(clip.createdAt).toLocaleDateString('pt-BR')}</span>
                                            <div className="flex gap-2">
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  navigator.clipboard.writeText(clip.text);
                                                  setShowCopyStatus(prev => ({ ...prev, [clip.id]: true }));
                                                  setTimeout(() => {
                                                    setShowCopyStatus(prev => ({ ...prev, [clip.id]: false }));
                                                  }, 1500);
                                                }}
                                                className="hover:text-[#D44E3D] font-bold uppercase transition-colors flex items-center gap-1 text-[9px]"
                                                title="Copiar texto"
                                              >
                                                {showCopyStatus[clip.id] ? <Check className="w-2.5 h-2.5 text-green-600" /> : <Copy className="w-2.5 h-2.5" />}
                                                {showCopyStatus[clip.id] ? 'Copiado' : 'Copiar'}
                                              </button>
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeepenNotebookItem(clip, 'clipping');
                                                }}
                                                className="hover:text-amber-500 font-bold uppercase transition-colors flex items-center gap-1 text-[9px] text-[#C2410C]"
                                                title="Aprofundar este trecho com o Preceptor IA (gasta 3 créditos)"
                                              >
                                                <Brain className="w-2.5 h-2.5 text-orange-600" />
                                                Aprofundar IA (3cr)
                                              </button>
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const confirmRemove = confirm('Deseja excluir este recorte?');
                                                  if (confirmRemove) {
                                                    removeClipping(clip.id);
                                                  }
                                                }}
                                                className="hover:text-red-600 font-bold uppercase transition-colors text-[9px]"
                                                title="Excluir"
                                              >
                                                Excluir
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}

                              {highlights.length > 0 && (
                                <div className="border border-[#E2E0D9] rounded-xl overflow-hidden bg-white shadow-sm">
                                  <div className="bg-[#F4F2EE] px-3 py-2 text-xs font-bold text-[#1A1A1A] flex justify-between items-center border-b border-[#E2E0D9]">
                                    <span>✨ Trechos Grifados</span>
                                    <span className="text-[9px] bg-slate-200/80 px-1.5 py-0.2 rounded-full font-bold text-gray-600">
                                      {highlights.length}
                                    </span>
                                  </div>
                                  <div className="p-2 space-y-1.5">
                                    {highlights.map((hl, hlIdx) => (
                                      <div 
                                        key={`notebook-hl-${hl.id}-${hlIdx}`} 
                                        onClick={() => scrollToText(hl.text, hl.id)}
                                        style={{ backgroundColor: `${hl.color}18`, borderColor: hl.color }}
                                        className="group p-2 rounded-lg border hover:scale-[1.01] hover:border-[#D44E3D]/30 hover:bg-rose-50/15 cursor-pointer transition-all relative flex items-center justify-between"
                                        title="Clique para rolar até o grifo no resumo"
                                      >
                                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                                          <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: hl.color }} />
                                          <span className="text-xs text-gray-800 font-medium truncate font-sans">"{hl.text}"</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeepenNotebookItem(hl, 'highlight');
                                            }}
                                            className="p-1 rounded-full hover:bg-amber-100 text-amber-700 transition-colors shrink-0 flex items-center gap-1 border border-amber-200/50 bg-amber-50/70"
                                            title={(() => {
                                              try {
                                                const key = userId ? `smart_pen_drawings_${userId}_highlight_${hl.id}` : `smart_pen_drawings_highlight_${hl.id}`;
                                                const saved = safeLocalStorageGet(key);
                                                return (saved && JSON.parse(saved).length > 0) ? "Aprofundar este grifo + caneta inteligente com o Preceptor IA (5 créditos)" : "Aprofundar este grifo com o Preceptor IA (3 créditos)";
                                              } catch {
                                                return "Aprofundar este grifo com o Preceptor IA (3 créditos)";
                                              }
                                            })()}
                                          >
                                            <Brain className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                                            <span className="text-[8px] font-black uppercase tracking-wider text-orange-700 block px-0.5">
                                              {(() => {
                                                try {
                                                  const key = userId ? `smart_pen_drawings_${userId}_highlight_${hl.id}` : `smart_pen_drawings_highlight_${hl.id}`;
                                                  const saved = safeLocalStorageGet(key);
                                                  return (saved && JSON.parse(saved).length > 0) ? '5cr' : '3cr';
                                                } catch {
                                                  return '3cr';
                                                }
                                              })()}
                                            </span>
                                          </button>
                                          <button
                                            onClick={(e) => handleDeleteHighlight(e, hl.id)}
                                            className="p-1 rounded-full hover:bg-red-50 text-[#8E8A82] hover:text-red-600 transition-colors shrink-0"
                                            title="Remover grifo"
                                          >
                                            <X className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-all shrink-0" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {notebookTab === 'images' && (
                        <div className="space-y-4">
                          {/* Add manual photo section */}
                          <div className="bg-white border border-[#E2E0D9] rounded-xl p-3 shadow-sm space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#1A1A1A] flex items-center gap-1.5">
                              <UploadIcon className="w-3.5 h-3.5 text-[#D44E3D]" />
                              Adicionar Foto Própria
                            </h4>
                            
                            <div className="space-y-2">
                              {/* File Input */}
                              <div className="flex flex-col items-stretch">
                                <label className="border border-dashed border-stone-200 hover:border-[#D44E3D]/50 bg-stone-50 hover:bg-stone-50/50 rounded-lg p-2.5 text-center cursor-pointer transition-all">
                                  <UploadIcon className="w-4 h-4 mx-auto text-stone-400 mb-1" />
                                  <span className="text-[10px] font-bold text-stone-600 block">Escolher arquivo de imagem</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = async (event) => {
                                          const base64Url = event.target?.result as string;
                                          if (base64Url) {
                                            const newIll = {
                                              id: Math.random().toString(36).substr(2, 9),
                                              phrase: file.name.split('.')[0] || 'Foto Própria',
                                              url: base64Url,
                                              sourceType: 'uploaded' as const,
                                              createdAt: new Date().toISOString()
                                            };
                                            const updated = [...illustrations, newIll];
                                            setIllustrations(updated);
                                            await saveAnnotations(highlights, clippings, updated);
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>
                              </div>

                              {/* URL Link Input */}
                              <div className="flex gap-1.5 items-center">
                                <Input
                                  placeholder="Ou cole o link da foto (HTTP/HTTPS)"
                                  className="text-[10px] h-8 bg-stone-50/50"
                                  id="manual-img-link"
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      const input = e.currentTarget;
                                      const val = input.value.trim();
                                      if (val) {
                                        const newIll = {
                                          id: Math.random().toString(36).substr(2, 9),
                                          phrase: 'Link Externo',
                                          url: val,
                                          sourceType: 'link' as const,
                                          createdAt: new Date().toISOString()
                                        };
                                        const updated = [...illustrations, newIll];
                                        setIllustrations(updated);
                                        await saveAnnotations(highlights, clippings, updated);
                                        input.value = '';
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  className="h-8 text-[10px] uppercase font-black"
                                  onClick={async () => {
                                    const input = document.getElementById('manual-img-link') as HTMLInputElement;
                                    const val = input?.value?.trim();
                                    if (val) {
                                      const newIll = {
                                        id: Math.random().toString(36).substr(2, 9),
                                        phrase: 'Link Externo',
                                        url: val,
                                        sourceType: 'link' as const,
                                        createdAt: new Date().toISOString()
                                      };
                                      const updated = [...illustrations, newIll];
                                      setIllustrations(updated);
                                      await saveAnnotations(highlights, clippings, updated);
                                      input.value = '';
                                    }
                                  }}
                                >
                                  Adicionar
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Gallery List */}
                          {illustrations.length === 0 ? (
                            <div className="text-center py-16 text-[#8E8A82]">
                              <ImageIcon className="w-8 h-8 mx-auto mb-3 opacity-25" />
                              <p className="text-xs leading-relaxed font-medium">
                                Nenhuma imagem gerada ou adicionada ainda.<br />
                                Use o recurso <span className="font-bold underline text-amber-600">Pedir Foto</span> ao selecionar palavras no texto!
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {illustrations.map((ill, idx) => (
                                <SidebarIllustrationCard
                                  key={`sidebar-ill-${ill.id}-${idx}`}
                                  ill={ill}
                                  onSearchReplacement={(id, phrase) => handleOpenIllustrationSearchModal(phrase, id)}
                                  onRemove={async () => {
                                    const confirmRemove = confirm('Deseja fechar e excluir esta foto do seu atlas?');
                                    if (confirmRemove) {
                                      const updated = illustrations.filter(i => i.id !== ill.id);
                                      setIllustrations(updated);
                                      await saveAnnotations(highlights, clippings, updated);
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subscription / Upgrade Modal */}
        <AnimatePresence>
          {showSubscriptionModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-[#FAF9F6] border-2 border-[#D4C3B3] rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 text-stone-800"
              >
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 p-6 text-white relative">
                  <button
                    onClick={() => {
                      setShowSubscriptionModal(false);
                      // Reset payment states on close
                      setPixGenerated(false);
                      setCheckoutUrl('');
                      setPaymentError('');
                    }}
                    className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-full cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="w-7 h-7 text-yellow-300 animate-pulse fill-yellow-300" />
                    <span className="text-xs uppercase font-black tracking-widest bg-white/20 px-2.5 py-1 rounded-full">
                      Upgrade Necessário
                    </span>
                  </div>
                  <h3 className="font-sans font-bold text-2xl tracking-tight">
                    Créditos Diários de IA Insuficientes
                  </h3>
                  <p className="text-white/90 text-sm mt-1 max-w-2xl font-medium">
                    Você está na conta <strong className="underline">{getAccountLabel()}</strong> e tem apenas <strong className="text-yellow-300">{globalQuota?.available || 0} de {globalQuota?.limit || 10}</strong> créditos restantes hoje.
                    Esta operação requer <strong className="text-yellow-200">{getCalculatedCost()}</strong> créditos.
                  </p>
                </div>

                <div className="p-6 lg:p-8 space-y-8 max-h-[calc(100vh-16rem)] overflow-y-auto">
                  {/* Grid of Plans */}
                  <div>
                    <h4 className="font-sans font-black text-[#4E4B42] text-xs uppercase tracking-widest mb-4">
                      Selecione o plano desejado para liberar acesso imediato:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Plan: Med Revise Pro */}
                      <div
                        onClick={() => {
                          setSelectedPlanForUpgrade('med_revise_pro');
                          setPixGenerated(false);
                          setCheckoutUrl('');
                        }}
                        className={cn(
                          "border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between bg-white relative",
                          selectedPlanForUpgrade === 'med_revise_pro'
                            ? "border-amber-600 ring-2 ring-amber-600/20 shadow-md"
                            : "border-[#E2E0D9] hover:border-[#D4C3B3]"
                        )}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-sans font-black text-amber-800 text-[10px] uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-full">
                              Intermediário
                            </span>
                            {selectedPlanForUpgrade === 'med_revise_pro' && (
                              <CheckCircle2 className="w-5 h-5 text-amber-600" />
                            )}
                          </div>
                          <h5 className="font-sans font-extrabold text-stone-950 text-lg">Med Revise Pro</h5>
                          <p className="text-stone-500 text-xs mt-1">Para revisar conteúdos cotidianos de forma consistente.</p>
                          <div className="my-4">
                            <span className="font-sans font-black text-2xl text-stone-900">R$ 19,90</span>
                            <span className="text-stone-500 text-xs font-medium">/mês</span>
                          </div>
                          <ul className="space-y-2 border-t border-[#F2F0EA] pt-4 text-xs text-stone-700">
                            <li className="flex items-center gap-2">
                              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                              <span><strong>10 créditos / dia</strong> de IA (igual ao Gratuito)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>Resumos Avançados & Elite</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>Banco de Questões completo</span>
                            </li>
                          </ul>
                        </div>
                        <button className={cn(
                          "w-full py-2.5 rounded-xl font-bold font-sans text-xs uppercase tracking-wider mt-6 transition-all",
                          selectedPlanForUpgrade === 'med_revise_pro'
                            ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                            : "bg-[#F5F4F0] hover:bg-[#EDECE6] text-[#4E4B42]"
                        )}>
                          {selectedPlanForUpgrade === 'med_revise_pro' ? 'Plano Selecionado' : 'Selecionar'}
                        </button>
                      </div>

                      {/* Plan: Med Internato Premium */}
                      <div
                        onClick={() => {
                          setSelectedPlanForUpgrade('med_internato_premium');
                          setPixGenerated(false);
                          setCheckoutUrl('');
                        }}
                        className={cn(
                          "border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between bg-white relative overflow-hidden",
                          selectedPlanForUpgrade === 'med_internato_premium'
                            ? "border-[#D44E3D] ring-2 ring-[#D44E3D]/20 shadow-lg"
                            : "border-[#E2E0D9] hover:border-[#D4C3B3]"
                        )}
                      >
                        <div className="absolute top-0 right-0 bg-[#D44E3D] text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-sm">
                          Estrela ⭐
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-sans font-black text-[#D44E3D] text-[10px] uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded-full">
                              Recomendado
                            </span>
                            {selectedPlanForUpgrade === 'med_internato_premium' && (
                              <CheckCircle2 className="w-5 h-5 text-[#D44E3D]" />
                            )}
                          </div>
                          <h5 className="font-sans font-extrabold text-stone-950 text-lg">Internato Premium</h5>
                          <p className="text-stone-500 text-xs mt-1">Acesso completo para internos de alta performance em hospitais.</p>
                          <div className="my-4">
                            <span className="font-sans font-black text-2xl text-stone-900">R$ 39,90</span>
                            <span className="text-stone-500 text-xs font-medium">/mês</span>
                          </div>
                          <ul className="space-y-2 border-t border-[#F2F0EA] pt-4 text-xs text-stone-700">
                            <li className="flex items-center gap-2">
                              <Zap className="w-3.5 h-3.5 text-[#D44E3D] fill-[#D44E3D] shrink-0" />
                              <span><strong>200 créditos / dia</strong> de IA</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>Geração de Monografias & Extensivo</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>Aprofundamentos ilimitados</span>
                            </li>
                          </ul>
                        </div>
                        <button className={cn(
                          "w-full py-2.5 rounded-xl font-bold font-sans text-xs uppercase tracking-wider mt-6 transition-all",
                          selectedPlanForUpgrade === 'med_internato_premium'
                            ? "bg-[#D44E3D] hover:bg-red-700 text-white shadow-sm"
                            : "bg-[#F5F4F0] hover:bg-[#EDECE6] text-[#4E4B42]"
                        )}>
                          {selectedPlanForUpgrade === 'med_internato_premium' ? 'Plano Selecionado' : 'Selecionar'}
                        </button>
                      </div>

                      {/* Plan: Combo Ouro */}
                      <div
                        onClick={() => {
                          setSelectedPlanForUpgrade('combo_ouro');
                          setPixGenerated(false);
                          setCheckoutUrl('');
                        }}
                        className={cn(
                          "border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between bg-white relative",
                          selectedPlanForUpgrade === 'combo_ouro'
                            ? "border-[#B59410] ring-2 ring-[#B59410]/20 shadow-md"
                            : "border-[#E2E0D9] hover:border-[#D4C3B3]"
                        )}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-sans font-black text-[#B59410] text-[10px] uppercase tracking-wider bg-yellow-50 px-2 py-0.5 rounded-full">
                              Absoluto
                            </span>
                            {selectedPlanForUpgrade === 'combo_ouro' && (
                              <CheckCircle2 className="w-5 h-5 text-[#B59410]" />
                            )}
                          </div>
                          <h5 className="font-sans font-extrabold text-stone-950 text-lg">Combo Ouro</h5>
                          <p className="text-stone-500 text-xs mt-1">Desbloqueio definitivo sem amarras para estudos residenciais intensos.</p>
                          <div className="my-4">
                            <span className="font-sans font-black text-2xl text-stone-900">R$ 49,90</span>
                            <span className="text-stone-500 text-xs font-medium">/mês</span>
                          </div>
                          <ul className="space-y-2 border-t border-[#F2F0EA] pt-4 text-xs text-stone-700">
                            <li className="flex items-center gap-2">
                              <Zap className="w-3.5 h-3.5 text-[#B59410] fill-[#B59410] shrink-0" />
                              <span><strong>250 créditos / dia</strong> de IA</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>Suporte e Preceptor Prioritário 24/7</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>Relatórios de evolução de elite</span>
                            </li>
                          </ul>
                        </div>
                        <button className={cn(
                          "w-full py-2.5 rounded-xl font-bold font-sans text-xs uppercase tracking-wider mt-6 transition-all",
                          selectedPlanForUpgrade === 'combo_ouro'
                            ? "bg-[#B59410] hover:bg-yellow-700 text-white shadow-sm"
                            : "bg-[#F5F4F0] hover:bg-[#EDECE6] text-[#4E4B42]"
                        )}>
                          {selectedPlanForUpgrade === 'combo_ouro' ? 'Plano Selecionado' : 'Selecionar'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Payment checkout with Mercado Pago */}
                  <div className="border border-[#D4C3B3] bg-[#F5F4F0] rounded-2xl p-6">
                    <div className="flex border-b border-[#D4C3B3] mb-6">
                      <button
                        onClick={() => {
                          setPaymentMethodTab('pix');
                          setPaymentError('');
                        }}
                        className={cn(
                          "flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2",
                          paymentMethodTab === 'pix'
                            ? "border-b-2 border-[#D44E3D] text-[#D44E3D]"
                            : "text-[#8E8A82] hover:text-[#4E4B42]"
                        )}
                      >
                        <QrCode className="w-4 h-4" />
                        Pagar com Pix (Instantâneo)
                      </button>
                      <button
                        onClick={() => {
                          setPaymentMethodTab('cartao');
                          setPaymentError('');
                        }}
                        className={cn(
                          "flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2",
                          paymentMethodTab === 'cartao'
                            ? "border-b-2 border-[#D44E3D] text-[#D44E3D]"
                            : "text-[#8E8A82] hover:text-[#4E4B42]"
                        )}
                      >
                        <CreditCard className="w-4 h-4" />
                        Mercado Pago (Cartão / Boleto)
                      </button>
                    </div>

                    {paymentError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-250 text-red-700 text-xs font-mono rounded-lg">
                        {paymentError}
                      </div>
                    )}

                    {paymentMethodTab === 'pix' ? (
                      <div className="space-y-4">
                        {pixGenerated ? (
                          <div className="flex flex-col md:flex-row items-center gap-6 animate-fade-in">
                            {/* Real QR Code */}
                            <div className="bg-white p-4 border border-[#E2E0D9] rounded-2xl shadow-inner flex flex-col items-center shrink-0">
                              <div className="w-36 h-36 bg-stone-100 flex items-center justify-center border-4 border-[#D44E3D]/10 rounded-lg relative overflow-hidden">
                                {pixQrBase64 ? (
                                  <img 
                                    src={`data:image/png;base64,${pixQrBase64}`} 
                                    alt="Mercado Pago QR Code PIX" 
                                    className="w-32 h-32 select-none pointer-events-none"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-32 h-32 flex items-center justify-center font-mono text-[9px] text-stone-400">
                                    QR Code Indisponível
                                  </div>
                                )}
                              </div>
                              <span className="text-[9px] font-bold text-stone-500 mt-2 uppercase tracking-wider">
                                Pix Transação Ativa
                              </span>
                            </div>

                            <div className="space-y-4 flex-1 w-full">
                              <div>
                                <h6 className="text-xs font-black text-stone-800 uppercase tracking-wide">
                                  Chave Pix de Recebimento (Copia e Cola):
                                </h6>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <input
                                    readOnly
                                    value={pixQrCode}
                                    className="bg-white border border-[#D4C3B3] text-stone-700 text-xs rounded-xl px-3 py-2 flex-1 focus:outline-none font-mono truncate select-all"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 border-[#D4C3B3] hover:bg-stone-100 text-stone-700 font-bold shrink-0"
                                    onClick={() => handleCopyToClipboard(pixQrCode)}
                                  >
                                    {copied ? <Check className="w-4 h-4 mr-1.5 text-green-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
                                    {copied ? 'Copiado!' : 'Copiar'}
                                  </Button>
                                </div>
                              </div>

                              <div className="text-xs text-stone-600 space-y-1 bg-stone-100/50 p-3 rounded-xl border border-stone-200">
                                <p><strong>Plano Selecionado:</strong> {selectedPlanForUpgrade === 'med_revise_pro' ? 'Med Revise Pro' : selectedPlanForUpgrade === 'med_internato_premium' ? 'Med Internato Premium' : 'Combo Ouro'}</p>
                                <p><strong>Valor Real:</strong> {selectedPlanForUpgrade === 'med_revise_pro' ? 'R$ 19,90' : selectedPlanForUpgrade === 'med_internato_premium' ? 'R$ 39,90' : 'R$ 49,90'}</p>
                                <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 animate-spin" />
                                  <span>Vence em: {formatTime(timeLeft)}</span>
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <Button
                                  onClick={handleCheckPixStatus}
                                  disabled={checkingStatus}
                                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-mono text-[11px] font-bold uppercase transition-all"
                                >
                                  {checkingStatus ? <Cpu className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
                                  Verificar Status
                                </Button>

                                <Button
                                  onClick={() => {
                                    setPixGenerated(false);
                                    setPixQrCode('');
                                    setPixQrBase64('');
                                  }}
                                  className="py-2.5 bg-neutral-200 hover:bg-neutral-350 text-neutral-800 font-mono text-[11px] font-bold uppercase border border-neutral-300 transition-all"
                                >
                                  Voltar
                                </Button>
                              </div>

                              {checkingStatusMessage && (
                                <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-mono text-center rounded animate-pulse">
                                  {checkingStatusMessage}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={handleCreateRealPix} className="space-y-4 animate-fade-in">
                            <div className="p-3 bg-amber-50 border border-amber-200 text-stone-700 text-xs rounded-xl leading-relaxed">
                              Preencha os dados do titular abaixo para gerar a cobrança via Pix integrado de forma segura ao Mercado Pago.
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-stone-600 mb-1">
                                  Primeiro Nome
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={firstName}
                                  onChange={(e) => setFirstName(e.target.value)}
                                  placeholder="Lucas"
                                  className="w-full bg-white border border-[#D4C3B3] text-stone-800 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-stone-600 mb-1">
                                  Sobrenome
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={lastName}
                                  onChange={(e) => setLastName(e.target.value)}
                                  placeholder="Melo"
                                  className="w-full bg-white border border-[#D4C3B3] text-stone-800 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-stone-600 mb-1">
                                CPF do Titular (Obrigatório para o Pix)
                              </label>
                              <input
                                type="text"
                                required
                                value={cpf}
                                onChange={(e) => {
                                  const rawVal = e.target.value.replace(/\D/g, '');
                                  if (rawVal.length <= 11) setCpf(rawVal);
                                }}
                                placeholder="Apenas números (11 dígitos)"
                                className="w-full bg-white border border-[#D4C3B3] text-stone-800 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                              />
                            </div>

                            {/* Campo de Código de Indicação / Cupom do Usuário */}
                            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-stone-600">
                                Código de Indicação / Cupom do Usuário (Opcional)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={referralCodeInput}
                                  onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                                  placeholder="Ex: CÓDIGO-DO-AMIGO"
                                  className="flex-1 bg-white border border-[#D4C3B3] text-stone-800 text-xs font-mono uppercase rounded-lg px-3 py-2 focus:outline-none"
                                />
                                <Button
                                  type="button"
                                  onClick={handleApplyTopicReferralCode}
                                  disabled={isApplyingTopicReferral || !referralCodeInput.trim()}
                                  className="bg-stone-800 hover:bg-black text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                  {isApplyingTopicReferral ? 'Aplicando...' : 'Aplicar'}
                                </Button>
                              </div>
                              {topicReferralMsg && (
                                <p className={`text-[10px] font-bold ${topicReferralMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {topicReferralMsg.text}
                                </p>
                              )}
                            </div>

                            <Button
                              type="submit"
                              disabled={generatingPix}
                              className="w-full bg-[#D44E3D] hover:bg-red-700 text-white font-sans font-extrabold py-3.5 text-xs uppercase tracking-widest rounded-xl transition-colors cursor-pointer"
                            >
                              {generatingPix ? (
                                <span className="flex items-center justify-center gap-2">
                                  <Cpu className="animate-spin text-yellow-300 w-4 h-4" />
                                  CONECTANDO COM MERCADO PAGO...
                                </span>
                              ) : (
                                <span className="flex items-center justify-center gap-2">
                                  <Zap className="text-yellow-300 fill-yellow-300 w-4 h-4" />
                                  Gerar Cobrança Pix de {selectedPlanForUpgrade === 'med_revise_pro' ? 'R$ 19,90' : selectedPlanForUpgrade === 'med_internato_premium' ? 'R$ 39,90' : 'R$ 49,90'}
                                </span>
                              )}
                            </Button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4 animate-fade-in">
                        <p className="text-xs text-stone-600 leading-relaxed">
                          Abra o portal seguro de faturamento do Mercado Pago para efetuar o pagamento via Cartão de Crédito ou Boleto Bancário.
                        </p>

                        {checkoutUrl ? (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl space-y-3">
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block">
                              ⚡ Preferência Registrada com Sucesso!
                            </span>
                            <a
                              href={checkoutUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full text-center py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-mono text-[11px] font-bold uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-2"
                            >
                              <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                              ABRIR TELA DE PAGAMENTO SEGURO ↗
                            </a>
                          </div>
                        ) : (
                          <Button
                            onClick={handleRealCheckout}
                            disabled={processingPayment}
                            className="w-full bg-[#D44E3D] hover:bg-red-700 text-white font-sans font-extrabold py-3.5 text-xs uppercase tracking-widest rounded-xl transition-colors cursor-pointer"
                          >
                            {processingPayment ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Registrando faturamento no Mercado Pago...
                              </span>
                            ) : (
                              <span>
                                Iniciar Checkout Seguro do Plano {selectedPlanForUpgrade === 'med_revise_pro' ? 'Med Revise Pro (R$ 19,90)' : selectedPlanForUpgrade === 'med_internato_premium' ? 'Internato Premium (R$ 39,90)' : 'Combo Ouro (R$ 49,90)'}
                              </span>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Summary Generation Wizard Modal */}
          {showSummaryWizard && (
            <div className="fixed inset-0 z-[9999] bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <SummaryGenerationWizard
                topicTitle={topic.title}
                availableCredits={availableCredits || 100}
                isGenerating={isGenerating}
                initialAnalysis={analysisResult}
                onRunAnalysis={async (selectedDepth) => {
                  setDepth(selectedDepth as GenerationDepth);
                  const subjectName = subjects.find(s => s.id === topic.subjectId)?.name || '';
                  const res = await analyzeSummaryNeeds(topic.title, subjectName, selectedDepth as GenerationDepth);
                  if (res) {
                    setAnalysisResult(res);
                    if (res.chapters) setEditedChapters(res.chapters);
                  }
                  return res;
                }}
                onCancel={() => setShowSummaryWizard(false)}
                onGenerate={(config) => {
                  setShowSummaryWizard(false);
                  setDepth(config.depth as GenerationDepth);
                  setIllustrationLevel(config.illustrationLevel as any);
                  setAlertBoxLevel(config.alertBoxLevel);
                  if (config.referencePref) setReferencePref(config.referencePref);
                  if (config.chapters) setEditedChapters(config.chapters);
                  if (config.analysisResult) setAnalysisResult(config.analysisResult);
                  setTimeout(() => {
                    if (config.depth === 'custom_analyzed') {
                      handleGenerateCustomAnalyzedSummary(config.analysisResult, config);
                    } else {
                      handleGenerateAI(config);
                    }
                  }, 100);
                }}
              />
            </div>
          )}

          {/* Toast Notification for Offline Cache */}
          {offlineToastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-[10000] bg-[#1A1A1A] text-white px-4 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-3 max-w-md select-none"
            >
              <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-stone-200 leading-snug">
                {offlineToastMessage}
              </p>
              <button 
                onClick={() => setOfflineToastMessage(null)}
                className="text-stone-400 hover:text-white text-xs ml-auto p-1 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
