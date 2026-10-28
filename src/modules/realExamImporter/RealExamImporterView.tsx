import React, { useState, useEffect, useRef } from 'react';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Upload from 'lucide-react/dist/esm/icons/upload.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js';
import XCircle from 'lucide-react/dist/esm/icons/x-circle.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import Edit3 from 'lucide-react/dist/esm/icons/edit-3.js';
import Filter from 'lucide-react/dist/esm/icons/filter.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import Download from 'lucide-react/dist/esm/icons/download.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.js';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import Layers from 'lucide-react/dist/esm/icons/layers.js';
import Hash from 'lucide-react/dist/esm/icons/hash.js';
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle.js';
import FileSearch from 'lucide-react/dist/esm/icons/file-search.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in.js';
import ZoomOut from 'lucide-react/dist/esm/icons/zoom-out.js';
import AlertOctagon from 'lucide-react/dist/esm/icons/alert-octagon.js';
import ImageIcon from 'lucide-react/dist/esm/icons/image.js';
import { getAuth } from 'firebase/auth';
import { 
  RealExamQuestionItem, 
  ExamExtractionSummary, 
  ExtractionResult, 
  ReviewStatus,
  ExtractedAlternative 
} from './types';

import { parsePdfFile, renderPdfPageToCanvas } from './pdfParser';
import { processExamDocument } from './examExtractor';

export default function RealExamImporterView() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [pdfProxy, setPdfProxy] = useState<any>(null);

  // Filtros e seleção
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'ALERTS' | 'APPROVED' | 'REJECTED' | 'ANULADA'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  // Visualizador do PDF
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewingPage, setViewingPage] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.2);
  const [isRenderingPage, setIsRenderingPage] = useState(false);

  // Modo de edição humana da questão
  const [isEditing, setIsEditing] = useState(false);
  const [statementViewMode, setStatementViewMode] = useState<'CLEAN' | 'RAW' | 'COMPARE'>('CLEAN');
  const [editStatement, setEditStatement] = useState('');
  const [editAlternatives, setEditAlternatives] = useState<ExtractedAlternative[]>([]);
  const [editGabaritoLetter, setEditGabaritoLetter] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');

  // Metadados Automáticos da Prova (Instituição, Banca, Ano, Nome, Modalidade)
  const [metaExamName, setMetaExamName] = useState<string>('');
  const [metaInstitution, setMetaInstitution] = useState<string>('');
  const [metaBanca, setMetaBanca] = useState<string>('');
  const [metaAnoAplicacao, setMetaAnoAplicacao] = useState<string>('');
  const [metaAnoPublicacao, setMetaAnoPublicacao] = useState<string>('');
  const [metaModalidade, setMetaModalidade] = useState<string>('');
  const [isEditingMetadata, setIsEditingMetadata] = useState<boolean>(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState<boolean>(false);

  // Ao selecionar uma questão, atualiza página do visualizador e campos de edição
  const selectedQuestion = extractionResult?.questions.find(q => q.id === selectedQuestionId) || null;

  useEffect(() => {
    if (selectedQuestion) {
      if (selectedQuestion.sourcePages.length > 0) {
        setViewingPage(selectedQuestion.sourcePages[0]);
      }
      setIsEditing(false);
      setEditStatement(selectedQuestion.adminModifications?.editedStatement || selectedQuestion.statement);
      setEditAlternatives(selectedQuestion.adminModifications?.editedAlternatives || selectedQuestion.alternatives);
      setEditGabaritoLetter(selectedQuestion.adminModifications?.editedGabaritoLetter || selectedQuestion.gabarito?.answerLetter || '');
      setEditNotes(selectedQuestion.adminModifications?.notes || '');
    }
  }, [selectedQuestionId]);

  // Renderiza a página no Canvas sempre que a página visualizada ou o zoom mudar
  useEffect(() => {
    if (pdfProxy && canvasRef.current && viewingPage > 0) {
      setIsRenderingPage(true);
      renderPdfPageToCanvas(pdfProxy, viewingPage, canvasRef.current, zoomScale)
        .then(() => setIsRenderingPage(false))
        .catch(() => setIsRenderingPage(false));
    }
  }, [pdfProxy, viewingPage, zoomScale]);

  // Handler de upload de PDF
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      alert('Por favor, selecione um arquivo no formato PDF (.pdf).');
      return;
    }

    setFile(selectedFile);
    await processPdf(selectedFile);
  };

  const processPdf = async (targetFile: File) => {
    setIsProcessing(true);
    setProgressPercent(0);
    setProgressStage('Iniciando processamento...');

    try {
      const parsed = await parsePdfFile(targetFile, (stage, pct) => {
        setProgressStage(stage);
        setProgressPercent(pct);
      });

      setPdfProxy(parsed.pdfDocProxy);
      setProgressStage('Analisando layout, questões e gabarito oficial...');

      const result = await processExamDocument(
        parsed.fileName,
        parsed.fileSizeBytes,
        parsed.fileSha256,
        parsed.pages
      );

      setExtractionResult(result);
      if (result.metadata) {
        setMetaExamName(result.metadata.examName || '');
        setMetaInstitution(result.metadata.institution || '');
        setMetaBanca(result.metadata.banca || '');
        setMetaAnoAplicacao(result.metadata.anoAplicacao ? result.metadata.anoAplicacao.toString() : '');
        setMetaAnoPublicacao(result.metadata.anoPublicacao ? result.metadata.anoPublicacao.toString() : '');
        setMetaModalidade(result.metadata.modalidade || '');
      }
      if (result.questions.length > 0) {
        setSelectedQuestionId(result.questions[0].id);
      }
    } catch (err: any) {
      console.error('Falha no processamento do PDF:', err);
      alert(`Falha ao ler o PDF: ${err?.message || 'Arquivo corrompido ou inacessível.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Atualização do status de revisão da questão (Aprovar, Rejeitar, etc.)
  const updateQuestionStatus = (questionId: string, status: ReviewStatus) => {
    if (!extractionResult) return;

    setExtractionResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        questions: prev.questions.map(q => {
          if (q.id === questionId) {
            return { ...q, reviewStatus: status };
          }
          return q;
        })
      };
    });
  };

  // Salvar alterações manuais feitas pelo administrador mantendo rastreabilidade
  const saveAdminEdits = () => {
    if (!selectedQuestion || !extractionResult) return;

    setExtractionResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        questions: prev.questions.map(q => {
          if (q.id === selectedQuestion.id) {
            return {
              ...q,
              reviewStatus: 'APPROVED',
              adminModifications: {
                editedStatement: editStatement.trim(),
                editedAlternatives: editAlternatives,
                editedGabaritoLetter: editGabaritoLetter ? editGabaritoLetter.toUpperCase().trim() : null,
                notes: editNotes.trim(),
                updatedAt: new Date().toISOString()
              }
            };
          }
          return q;
        })
      };
    });

    setIsEditing(false);
  };

  // Aprovação em lote de questões sem alertas
  const handleApproveAllClean = () => {
    if (!extractionResult) return;
    const count = extractionResult.questions.filter(q => q.validationAlerts.length === 0 && q.reviewStatus === 'PENDING').length;
    
    if (count === 0) {
      alert('Não há questões pendentes sem alertas para aprovação automática.');
      return;
    }

    if (confirm(`Deseja aprovar automaticamente ${count} questão(ões) sem nenhum alerta de inconsistência?`)) {
      setExtractionResult(prev => {
        if (!prev) return null;
        return {
          ...prev,
          questions: prev.questions.map(q => {
            if (q.validationAlerts.length === 0 && q.reviewStatus === 'PENDING') {
              return { ...q, reviewStatus: 'APPROVED' };
            }
            return q;
          })
        };
      });
    }
  };

  // Exportação do lote auditado em JSON (para carga isolada futura)
  const handleExportJson = () => {
    if (!extractionResult) return;

    const exportData = {
      meta: {
        importer: 'MedRevise Real Exam Importer v1.0',
        exportedAt: new Date().toISOString(),
        fileName: extractionResult.summary.fileName,
        fileSha256: extractionResult.summary.fileSha256,
        totalPages: extractionResult.summary.totalPages,
        gabaritoPages: extractionResult.summary.gabaritoPages,
        detectedMetadata: {
          examName: metaExamName || extractionResult.metadata?.examName || null,
          institution: metaInstitution || extractionResult.metadata?.institution || null,
          banca: metaBanca || extractionResult.metadata?.banca || null,
          anoAplicacao: metaAnoAplicacao ? parseInt(metaAnoAplicacao, 10) : extractionResult.metadata?.anoAplicacao || null,
          anoPublicacao: metaAnoPublicacao ? parseInt(metaAnoPublicacao, 10) : extractionResult.metadata?.anoPublicacao || null,
          modalidade: metaModalidade || extractionResult.metadata?.modalidade || null,
          multipleExamsDetected: extractionResult.metadata?.multipleExamsDetected || false,
          evidenceSources: extractionResult.metadata?.evidenceSources || [],
        }
      },
      summary: extractionResult.summary,
      questions: extractionResult.questions.map(q => ({
        id: q.id,
        questionNumber: q.questionNumber,
        originalStatement: q.statement,
        originalAlternatives: q.alternatives,
        sourcePages: q.sourcePages,
        questionType: q.questionType,
        gabarito: q.gabarito,
        validationAlerts: q.validationAlerts,
        reviewStatus: q.reviewStatus,
        adminModifications: q.adminModifications || null,
        // Texto final efetivo
        effectiveStatement: q.adminModifications?.editedStatement || q.statement,
        effectiveAlternatives: q.adminModifications?.editedAlternatives || q.alternatives,
        effectiveGabaritoLetter: q.adminModifications?.editedGabaritoLetter !== undefined 
          ? q.adminModifications.editedGabaritoLetter 
          : q.gabarito?.answerLetter || null,
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medrevise_prova_real_${extractionResult.summary.fileName.replace(/\.pdf$/i, '')}_auditado.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Salvar lote aprovado no staging (medrevise_staging)
  const handleSaveToStaging = async () => {
    if (!extractionResult) return;
    const approvedQuestions = extractionResult.questions.filter(q => q.reviewStatus === 'APPROVED');
    
    if (approvedQuestions.length === 0) {
      alert('Não há questões com status "APROVADA" para salvar no staging. Aprove as questões revisadas antes de enviar.');
      return;
    }

    if (!confirm(`Deseja enviar ${approvedQuestions.length} questão(ões) aprovada(s) para o banco de staging (medrevise_staging)?`)) {
      return;
    }

    setIsProcessing(true);
    setProgressStage('Enviando lote aprovado para o staging com segurança...');
    setProgressPercent(30);

    try {
      const batchId = `batch_real_exam_${Date.now()}`;
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        alert('Usuário não autenticado.');
        setIsProcessing(false);
        return;
      }
      const token = await user.getIdToken();
      
      const res = await fetch('/api/admin/staging/save-batch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          batchId,
          questions: approvedQuestions
        })
      });

      setProgressPercent(80);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha na resposta do servidor.');
      }

      setProgressPercent(100);
      if (data.mode === 'simulated' || data.persisted === false) {
        alert(`[MODO SIMULADO SEGURO - persisted: false]\nO servidor não possui a chave SUPABASE_SERVICE_ROLE_KEY configurada neste ambiente.\nNenhum dado foi gravado no banco de staging real.\n\nProcessados: ${data.totalProcessed} questões.`);
      } else {
        alert(`[PERSISTÊNCIA REAL CONFIRMADA - persisted: true]\nLote gravado com sucesso no schema medrevise_staging!\nStatus: ${data.status}\nInseridas/Idênticas: ${data.insertedCount}\nConflitos: ${data.conflictCount}\nErros: ${data.errorCount}`);
      }
    } catch (err: any) {
      console.error('Erro ao salvar no staging:', err);
      alert(`Falha ao salvar no staging: ${err.message || 'Erro de conexão.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Carregar dados piloto de demonstração para conferência imediata
  const handleLoadDemoPilot = async () => {
    setIsProcessing(true);
    setProgressStage('Gerando lote-piloto representativo de 10 questões com gabarito oficial final...');
    setProgressPercent(50);

    setTimeout(async () => {
      // Simulação fiel de uma prova médica real (Enare / USP) com gabarito nas páginas finais
      const demoPages = [
        {
          pageNumber: 1,
          text: `PROVA DE RESIDÊNCIA MÉDICA 2026 - ACESSO DIRETO
CADERNO DE QUESTÕES OBJETIVAS

QUESTÃO 01
Homem de 62 anos, hipertenso e diabético de longa data, procura a Unidade de Pronto Atendimento com queixa de dor precordial em aperto de forte intensidade, iniciada há 2 horas, irradiada para o membro superior esquerdo e dorso, associada a sudorese profusa e náuseas. Ao exame físico: PA 155x95 mmHg, FC 98 bpm, FR 20 irpm, SatO2 96% em ar ambiente. Bulhas rítmicas normofonéticas sem sopros, murmúrio vesicular presente bilateralmente sem ruídos adventícios. O eletrocardiograma de 12 derivações demonstra supradesnivelamento do segmento ST de 3 mm nas derivações DII, DIII e aVF. Considerando a principal hipótese diagnóstica, assinale a conduta imediata mais adequada:
A) Encaminhar para teste ergométrico ambulatorial e dosar troponina seriada.
B) Iniciar terapia trombolítica caso a angioplastia coronária não esteja disponível em até 120 minutos do primeiro contato médico.
C) Administrar betabloqueador venoso em bolus imediato antes de qualquer exame confirmatório.
D) Prescrever analgésicos comuns e solicitar radiografia contrastada de esôfago para descartar espasmo difuso.
E) Realizar pericardiocentese diagnóstica de urgência.

QUESTÃO 02
Mulher de 28 anos, primigesta com 32 semanas de gestação, comparece à consulta pré-natal de rotina assintomática. Ao exame obstétrico: altura uterina de 31 cm, BCF 144 bpm, movimentação fetal presente. Aferição da pressão arterial revela 145x92 mmHg, confirmada após 4 horas de repouso (148x94 mmHg). Exame de urina simples revela fita reagente com proteinúria (++). A contagem de plaquetas é de 160.000/mm³, creatinina 0,7 mg/dL, AST e ALT dentro dos limites normais. Qual o diagnóstico e a conduta recomendada?
A) Hipertensão gestacional transitória; alta com orientação de retorno com 37 semanas.
B) Pré-eclâmpsia sem sinais de gravidade; acompanhamento materno-fetal rigoroso e interrupção da gestação a termo.
C) Síndrome HELLP iminente; interrupção imediata por via cesariana e sulfato de magnésio contínuo.
D) Hipertensão arterial crônica com sobreposição; início de inibidor da ECA imediatamente.
E) Eclâmpsia em estágio inicial; internação em UTI e parto imediato.`
        },
        {
          pageNumber: 2,
          text: `QUESTÃO 03
Lactente de 8 meses é trazido à emergência pediátrica pela mãe com história de febre alta (39,2 °C) há 3 dias, irritabilidade e recusa alimentar parcial. Hoje pela manhã, a febre cessou subitamente, mas a mãe notou o surgimento de exantema maculopapular róseo, não pruriginoso, com início no tronco e rápida disseminação para pescoço e membros. A criança encontra-se ativa, hidratada, sem sinais meníngeos ou linfonodomegalias significativas. Qual é o agente etiológico mais provável desse quadro clínico?
A) Parvovírus B19.
B) Vírus do sarampo.
C) Herpesvírus humano tipo 6 (HHV-6).
D) Estreptococo beta-hemolítico do grupo A.
E) Vírus da rubéola.

QUESTÃO 04
Paciente masculino, 45 anos, vítima de colisão moto x anteparo, é admitido no setor de trauma imobilizado em prancha rígida e colar cervical. Na avaliação primária (ABCDE): A: vias aéreas pérvias com colar cervical; B: taquipneico (FR 32 irpm), murmúrio vesicular abolido à direita com hipertimpanismo à percussão, turgência jugular patológica bilateral e desvio traqueal para a esquerda; C: PA 75x40 mmHg, FC 138 bpm, pulsos filiformes. Qual a conduta imediata a ser realizada?
A) Solicitar tomografia computadorizada de tórax com contraste para descartar rotura aórtica.
B) Descompressão torácica imediata com agulha no 5º espaço intercostal entre as linhas axilar anterior e média à direita, seguida de drenagem sob selo d'água.
C) Intubação orotraqueal em sequência rápida e infusão de 2.000 mL de solução fisiológica a 0,9%.
D) Pericardiocentese subxifóidea de urgência (manobra de Marfan).
E) Toracotomia exploradora bilateral de emergência no leito de trauma.`
        },
        {
          pageNumber: 3,
          text: `QUESTÃO 05
Mulher de 54 anos procura atendimento médico ambulatorial referindo pirose retroesternal e regurgitação ácida há 6 meses, com piora ao deitar-se. Nega disfagia, odinofagia, emagrecimento ou sangramento digestivo. Foi submetida à endoscopia digestiva alta que revelou mucosa de aspecto aveludado, avermelhada, estendendo-se por 3 cm acima da transição esofagogástrica. O laudo histopatológico confirmou epitélio colunar especializado com células caliciformes (metaplasia intestinal), sem displasia. Diante do diagnóstico de Esôfago de Barrett curto sem displasia, qual é a conduta preconizada pelas diretrizes atuais?
A) Esofagectomia subtotal com reconstrução gástrica.
B) Otimização do inibidor de bomba de prótons e vigilância endoscópica a cada 3 a 5 anos.
C) Ablação por radiofrequência profilática mandatória de toda a mucosa metaplásica.
D) Interrupção de qualquer medicação antissecretora e reavaliação anual.
E) Fundoplicatura videolaparoscópica de emergência para prevenir adenocarcinoma invasivo.

QUESTÃO 06
Homem de 70 anos é trazido por familiares por quadro de tosse produtiva com escarro amarelado, febre aferida de 38,8 °C e confusão mental aguda há 24 horas. Ao exame físico: desorientado no tempo e no espaço, PA 85x55 mmHg, FC 110 bpm, FR 32 irpm, SatO2 91% em ar ambiente. Exames laboratoriais: ureia 78 mg/dL, creatinina 1,4 mg/dL, leucocitose de 18.500/mm³ com 10% de bastões. A radiografia de tórax evidencia consolidação no lobo inferior direito com broncograma aéreo. Utilizando o escore CURB-65 para estratificação de risco na pneumonia adquirida na comunidade, qual é a pontuação do paciente e o local de tratamento indicado?
A) CURB-65 = 1 ponto; tratamento ambulatorial com amoxicilina oral.
B) CURB-65 = 2 pontos; observação breve em enfermaria por 12 horas.
C) CURB-65 = 4 pontos; internação hospitalar imediata, preferencialmente em Unidade de Terapia Intensiva (UTI).
D) CURB-65 = 0 pontos; alta com azitromicina.
E) CURB-65 = 5 pontos; cuidados paliativos exclusivos.`
        },
        {
          pageNumber: 4,
          text: `QUESTÃO 07
Mulher de 35 anos procura auxílio na Unidade Básica de Saúde devido a quadro de astenia progressiva, sonolência diurna excessiva, constipação intestinal e ganho ponderal de 4 kg nos últimos 4 meses, apesar da redução do apetite. Ao exame físico: tireoide palpável, indolor, de consistência fibroelástica e volume discretamente aumentado; reflexo aquileu com fase de relaxamento lentificada. Exames laboratoriais revelam: TSH 18,5 mUI/L (VR: 0,4 a 4,5), T4 livre 0,4 ng/dL (VR: 0,8 a 1,8) e anticorpo anti-tireoperoxidase (anti-TPO) francamente positivo. Qual é o tratamento de escolha para esta paciente?
A) Levotiroxina sódica oral em dose única diária em jejum.
B) Metimazol 10 mg ao dia associado a propranolol.
C) Propiltiouracila fracionada de 8 em 8 horas.
D) Iodo radioativo (I-131) para ablação do tecido tireoidiano hipertrofiado.
E) Suplementação exclusiva de selênio e zinco quelato.

QUESTÃO 08
Observe a figura do eletrocardiograma abaixo e analise o caso clínico: Homem de 58 anos apresenta palpitações taquicárdicas súbitas e tontura. O traçado demonstra taquicardia de complexo QRS estreito, ritmo regular, FC de 180 bpm, sem ondas P visíveis antes dos complexos QRS. Manobra vagal foi realizada sem reversão. Paciente mantém estabilidade hemodinâmica (PA 120x80 mmHg). Assinale a conduta medicamentosa de primeira linha:
A) Amiodarona 300 mg EV em infusão lenta de 30 minutos.
B) Adenosina 6 mg em bolus venoso rápido seguido de flush de 20 mL de soro fisiológico.
C) Cardioversão elétrica sincronizada com 200 J imediata.
D) Digoxina 0,5 mg EV lenta.
E) Sulfato de magnésio 2 g em 15 minutos.`
        },
        {
          pageNumber: 5,
          text: `QUESTÃO 09
Em relação à bioética médica e às diretrizes antecipadas de vontade (DAV), segundo a Resolução CFM nº 1.995/2012 e o Código de Ética Médica brasileiro, é correto afirmar:
A) O médico deve prevalecer a vontade dos familiares de primeiro grau mesmo se contrária às DAV válidas registradas previamente pelo paciente.
B) As diretrizes antecipadas de vontade do paciente prevalecerão sobre o parecer de qualquer outro colegiado ou sobre os desejos dos familiares, desde que em acordo com os ditames éticos.
C) O registro das DAV exige necessariamente chancela judicial prévia e averbação em cartório de notas para ter validade perante a equipe médica assistencial.
D) Em situações de emergência sem risco iminente de morte, as DAV devem ser suspensas automaticamente.
E) O médico não pode recusar-se a cumprir diretivas que estejam em desacordo com sua própria consciência moral ou crença religiosa.`
        },
        {
          pageNumber: 6,
          text: `QUESTÃO 10
(Questão referente a política de imunização do Ministério da Saúde)
Considere o calendário vacinal do Ministério da Saúde do Brasil para crianças no primeiro ano de vida. A vacina Pentavalente confere proteção contra quais patógenos?
A) Difteria, Tétano, Coqueluche, Hepatite B e Haemophilus influenzae tipo b.
B) Difteria, Tétano, Coqueluche, Febre Amarela e Sarampo.
C) Poliomielite, Rotavírus, Hepatite A, Tétano e Varicela.
D) Sarampo, Caxumba, Rubéola, Varicela e Hepatite B.
E) Meningococo C, Pneumococo 10, HPV, Influenza e Febre Tifoide.`
        },
        {
          pageNumber: 7,
          text: `UNIVERSIDADE NACIONAL DE EXAMES MÉDICOS
PROVA DE RESIDÊNCIA MÉDICA 2026

GABARITO OFICIAL DEFINITIVO DAS QUESTÕES OBJETIVAS
CADERNO DE PROVA REGULAR

Item  Resposta
01    B
02    B
03    C
04    B
05    B
06    C
07    A
08    B
09    B
10    A

Observações da Banca Examinadora:
Nenhuma questão foi anulada nesta versão preliminar.`
        }
      ];

      const result = await processExamDocument(
        'Prova_Residencia_Medica_Piloto_Real_2026.pdf',
        1450200,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        demoPages
      );

      setExtractionResult(result);
      if (result.metadata) {
        setMetaExamName(result.metadata.examName || '');
        setMetaInstitution(result.metadata.institution || '');
        setMetaBanca(result.metadata.banca || '');
        setMetaAnoAplicacao(result.metadata.anoAplicacao ? result.metadata.anoAplicacao.toString() : '');
        setMetaAnoPublicacao(result.metadata.anoPublicacao ? result.metadata.anoPublicacao.toString() : '');
        setMetaModalidade(result.metadata.modalidade || '');
      }
      if (result.questions.length > 0) {
        setSelectedQuestionId(result.questions[0].id);
      }
      setIsProcessing(false);
    }, 400);
  };

  // Filtragem das questões
  const filteredQuestions = (extractionResult?.questions || []).filter(q => {
    // Filtro por tipo/status
    if (activeFilter === 'PENDING' && q.reviewStatus !== 'PENDING') return false;
    if (activeFilter === 'APPROVED' && q.reviewStatus !== 'APPROVED') return false;
    if (activeFilter === 'REJECTED' && q.reviewStatus !== 'REJECTED') return false;
    if (activeFilter === 'ALERTS' && q.validationAlerts.length === 0) return false;
    if (activeFilter === 'ANULADA' && !q.gabarito?.isAnulada) return false;

    // Busca textual
    if (searchQuery.trim()) {
      const qNum = q.questionNumber.toString();
      const textMatch = q.statement.toLowerCase().includes(searchQuery.toLowerCase());
      const numMatch = qNum.includes(searchQuery.trim());
      const gabMatch = q.gabarito?.answerLetter?.toLowerCase() === searchQuery.toLowerCase();
      if (!textMatch && !numMatch && !gabMatch) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Cabeçalho do Importador */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-rose-100 text-[#D44E3D] border border-rose-200">
              Módulo de Fidelidade Documental
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-stone-100 text-stone-600 border border-stone-200">
              Banco Novo (Staging Isolado)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-black text-neutral-900 tracking-tight">
            Importador de Provas Médicas Reais em PDF
          </h1>
          <p className="text-xs text-[#8E8A82] max-w-3xl leading-relaxed">
            Fluxo exclusivo para documentos originais contendo a prova e o gabarito nas páginas finais. 
            Sem resumo, sem paráfrase de IA e sem criação de questões sintéticas. Preserva integralmente enunciados, alternativas e rastreabilidade documental.
          </p>
        </div>

        {/* Botão de Upload e Piloto */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-mono font-bold cursor-pointer transition-all shadow-sm">
            <Upload size={16} />
            <span>Selecionar PDF Único</span>
            <input 
              type="file" 
              accept="application/pdf,.pdf" 
              className="hidden" 
              onChange={handleFileChange}
              disabled={isProcessing}
            />
          </label>

          <button
            onClick={handleLoadDemoPilot}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all"
            title="Carrega o lote-piloto representativo de 10 questões com gabarito oficial para conferência imediata"
          >
            <Sparkles size={16} className="text-amber-600" />
            <span>Carregar Lote-Piloto Real (10 Questões)</span>
          </button>
        </div>
      </div>

      {/* Barra de Progresso / Carregando */}
      {isProcessing && (
        <div className="p-6 bg-white border border-rose-200 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-neutral-900 flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin text-[#D44E3D]" />
              {progressStage || 'Processando arquivo...'}
            </span>
            <span className="text-[#D44E3D] font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden border border-stone-200">
            <div 
              className="bg-[#D44E3D] h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Se não houver documento carregado */}
      {!extractionResult && !isProcessing && (
        <div className="p-12 bg-white border-2 border-dashed border-[#E2E0D9] rounded-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-neutral-500">
            <FileSearch size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-neutral-900">Nenhum exame em análise no momento</h3>
            <p className="text-xs text-[#8E8A82] max-w-md mx-auto">
              Envie um arquivo PDF de prova médica (ex: ENARE, Revalida, USP, SUS-SP) contendo o gabarito nas páginas finais, ou clique no botão acima para carregar o lote-piloto.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleLoadDemoPilot}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-mono font-bold cursor-pointer transition-all"
            >
              <Sparkles size={14} />
              <span>Testar com Lote Piloto Representativo</span>
            </button>
          </div>
        </div>
      )}

      {/* Painel do Exame Carregado */}
      {extractionResult && (
        <div className="space-y-6">
          {/* Card Resumo da Validação Automática da Associação (Item 4 da Especificação) */}
          <div className="p-5 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#E2E0D9]/70">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-neutral-900">
                    Resumo do Documento e Integridade da Associação
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    extractionResult.summary.confidenceLevel === 'HIGH' 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    Confiança: {extractionResult.summary.confidenceLevel}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-stone-500">
                  Arquivo: <span className="font-bold text-neutral-800">{extractionResult.summary.fileName}</span> | 
                  SHA-256: <span className="font-mono text-[10px] text-stone-600">{extractionResult.summary.fileSha256.substring(0, 16)}...</span> | 
                  Páginas de Gabarito: <span className="font-bold text-neutral-800">{extractionResult.summary.gabaritoPages.join(', ') || 'Não detectadas'}</span>
                </p>
              </div>

              {/* Botões de Ação do Lote */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleApproveAllClean}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all"
                  title="Aprova todas as questões pendentes que não possuem nenhum alerta"
                >
                  <Check size={14} />
                  <span>Aprovar Sem Alertas</span>
                </button>

                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-mono font-bold cursor-pointer transition-all shadow-xs"
                  title="Exporta o lote auditado em JSON para a etapa futura de gravação no banco isolado"
                >
                  <Download size={14} />
                  <span>Exportar Lote Auditado (JSON)</span>
                </button>

                <button
                  onClick={handleSaveToStaging}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D44E3D] hover:bg-[#bd3f31] text-white rounded-lg text-xs font-mono font-bold cursor-pointer transition-all shadow-xs"
                  title="Envia o lote de questões aprovadas para o staging (medrevise_staging)"
                >
                  <Upload size={14} />
                  <span>Salvar Lote no Staging</span>
                </button>
              </div>
            </div>

            {/* Grid de Métricas da Associação */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] font-mono uppercase text-stone-500 block">Questões Identificadas</span>
                <span className="text-xl font-display font-black text-neutral-900">
                  {extractionResult.summary.totalQuestionsIdentified}
                </span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] font-mono uppercase text-stone-500 block">Respostas no Gabarito</span>
                <span className="text-xl font-display font-black text-neutral-900">
                  {extractionResult.summary.totalGabaritoAnswersFound}
                </span>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-mono uppercase text-emerald-800 block">Com Gabarito Vinculado</span>
                <span className="text-xl font-display font-black text-emerald-700">
                  {extractionResult.summary.questionsWithAnswer}
                </span>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                <span className="text-[10px] font-mono uppercase text-amber-800 block">Sem Gabarito</span>
                <span className="text-xl font-display font-black text-amber-700">
                  {extractionResult.summary.questionsWithoutAnswer}
                </span>
              </div>

              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200">
                <span className="text-[10px] font-mono uppercase text-rose-800 block">Alertas / Discrepâncias</span>
                <span className="text-xl font-display font-black text-rose-700">
                  {extractionResult.summary.discrepanciesCount}
                </span>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200">
                <span className="text-[10px] font-mono uppercase text-indigo-800 block">Anuladas Oficiais</span>
                <span className="text-xl font-display font-black text-indigo-700">
                  {extractionResult.summary.anuladasCount}
                </span>
              </div>
            </div>
          </div>

          {/* Card de Metadados Automáticos da Prova (Item 2: Instituição, Banca, Ano, Modalidade) */}
          <div className="p-5 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E0D9]/70">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                    <Sparkles size={14} />
                  </div>
                  <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-neutral-900">
                    Metadados da Prova Identificados no Documento
                  </h3>
                </div>
                <p className="text-[11px] font-mono text-stone-500">
                  Preenchimento automático a partir de capas, cabeçalhos, rodapés e tags (com revisão opcional)
                </p>
              </div>

              <div className="flex items-center gap-2">
                {extractionResult.metadata?.evidenceSources?.length > 0 && (
                  <button
                    onClick={() => setShowEvidenceModal(!showEvidenceModal)}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1.5"
                    title="Exibir os trechos e páginas onde os metadados foram encontrados"
                  >
                    <Eye size={13} />
                    <span>{showEvidenceModal ? 'Ocultar Fontes' : 'Ver Fontes / Evidências'}</span>
                  </button>
                )}

                <button
                  onClick={() => setIsEditingMetadata(!isEditingMetadata)}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Edit3 size={13} />
                  <span>{isEditingMetadata ? 'Concluir Edição' : 'Editar Metadados'}</span>
                </button>
              </div>
            </div>

            {/* Alerta de múltiplos processos seletivos contraditórios */}
            {extractionResult.metadata?.multipleExamsDetected && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Atenção: Múltiplas Bancas ou Instituições Detectadas no Mesmo Documento</span>
                  <span className="leading-tight">{extractionResult.metadata.notes}</span>
                </div>
              </div>
            )}

            {/* Conteúdo: Modo Edição vs Modo Visualização */}
            {isEditingMetadata ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-stone-500">Nome da Prova / Processo:</label>
                  <input
                    type="text"
                    value={metaExamName}
                    onChange={(e) => setMetaExamName(e.target.value)}
                    placeholder="Ex: Exame Nacional de Residência Médica"
                    className="w-full p-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-stone-500">Instituição:</label>
                  <input
                    type="text"
                    value={metaInstitution}
                    onChange={(e) => setMetaInstitution(e.target.value)}
                    placeholder="Ex: ENARE / EBSERH ou USP"
                    className="w-full p-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-stone-500">Banca Examinadora:</label>
                  <input
                    type="text"
                    value={metaBanca}
                    onChange={(e) => setMetaBanca(e.target.value)}
                    placeholder="Ex: FGV, VUNESP, FUVEST, IBFC"
                    className="w-full p-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-stone-500">Ano de Aplicação (Prova):</label>
                  <input
                    type="number"
                    value={metaAnoAplicacao}
                    onChange={(e) => setMetaAnoAplicacao(e.target.value)}
                    placeholder="Ex: 2026"
                    className="w-full p-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-stone-500">Ano de Publicação (Edital):</label>
                  <input
                    type="number"
                    value={metaAnoPublicacao}
                    onChange={(e) => setMetaAnoPublicacao(e.target.value)}
                    placeholder="Ex: 2025"
                    className="w-full p-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-stone-500">Modalidade / Especialidade:</label>
                  <input
                    type="text"
                    value={metaModalidade}
                    onChange={(e) => setMetaModalidade(e.target.value)}
                    placeholder="Ex: Acesso Direto (R1)"
                    className="w-full p-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Campo 1: Nome da Prova */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase text-stone-500 font-bold">Prova</span>
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        (extractionResult.metadata?.examNameState === 'CONFIRMED' || metaExamName)
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : extractionResult.metadata?.examNameState === 'CANDIDATE'
                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {metaExamName ? (extractionResult.metadata?.examNameState || 'CONFIRMADO') : 'PENDENTE'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-neutral-900 block truncate" title={metaExamName || 'Não identificado'}>
                      {metaExamName || '— Não identificado —'}
                    </span>
                    {extractionResult.metadata?.evidenceSources?.find(e => e.field === 'examName') && (
                      <div className="text-[10px] text-stone-500 font-mono truncate">
                        Pág. {extractionResult.metadata.evidenceSources.find(e => e.field === 'examName')?.pageNumber}: "{extractionResult.metadata.evidenceSources.find(e => e.field === 'examName')?.sourceText}"
                      </div>
                    )}
                  </div>

                  {/* Campo 2: Instituição */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase text-stone-500 font-bold">Instituição</span>
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        extractionResult.metadata?.institutionState === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : extractionResult.metadata?.institutionState === 'CANDIDATE'
                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {metaInstitution ? (extractionResult.metadata?.institutionState || 'CONFIRMADO') : 'PENDENTE'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-neutral-900 block truncate" title={metaInstitution || 'Não identificado'}>
                      {metaInstitution || '— Não identificado —'}
                    </span>
                    {extractionResult.metadata?.evidenceSources?.find(e => e.field === 'institution') && (
                      <div className="text-[10px] text-stone-500 font-mono truncate">
                        Pág. {extractionResult.metadata.evidenceSources.find(e => e.field === 'institution')?.pageNumber}: "{extractionResult.metadata.evidenceSources.find(e => e.field === 'institution')?.sourceText}"
                      </div>
                    )}
                  </div>

                  {/* Campo 3: Banca */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase text-stone-500 font-bold">Banca</span>
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        extractionResult.metadata?.bancaState === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : extractionResult.metadata?.bancaState === 'CANDIDATE'
                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {metaBanca ? (extractionResult.metadata?.bancaState || 'CONFIRMADA') : 'PENDENTE'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-neutral-900 block truncate" title={metaBanca || 'Não identificada'}>
                      {metaBanca || '— Não identificada —'}
                    </span>
                    {extractionResult.metadata?.evidenceSources?.find(e => e.field === 'banca') && (
                      <div className="text-[10px] text-stone-500 font-mono truncate">
                        Pág. {extractionResult.metadata.evidenceSources.find(e => e.field === 'banca')?.pageNumber}: "{extractionResult.metadata.evidenceSources.find(e => e.field === 'banca')?.sourceText}"
                      </div>
                    )}
                  </div>

                  {/* Campo 4: Ano Aplicação */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase text-stone-500 font-bold">Ano Aplicação</span>
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        extractionResult.metadata?.anoAplicacaoState === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : extractionResult.metadata?.anoAplicacaoState === 'CANDIDATE'
                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {metaAnoAplicacao ? (extractionResult.metadata?.anoAplicacaoState || 'CONFIRMADO') : 'PENDENTE'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-neutral-900 block">
                      {metaAnoAplicacao || '—'}
                    </span>
                    {extractionResult.metadata?.evidenceSources?.find(e => e.field === 'anoAplicacao') && (
                      <div className="text-[10px] text-stone-500 font-mono truncate">
                        Pág. {extractionResult.metadata.evidenceSources.find(e => e.field === 'anoAplicacao')?.pageNumber}: "{extractionResult.metadata.evidenceSources.find(e => e.field === 'anoAplicacao')?.sourceText}"
                      </div>
                    )}
                  </div>

                  {/* Campo 5: Ano Edital / Publicação */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase text-stone-500 font-bold">Ano Edital</span>
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        extractionResult.metadata?.anoPublicacaoState === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-stone-200 text-stone-700'
                      }`}>
                        {extractionResult.metadata?.anoPublicacaoState === 'CONFIRMED' ? 'CONFIRMADO' : 'DOCUMENTAL'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-neutral-900 block">
                      {metaAnoPublicacao || (metaAnoAplicacao ? `Edital ${metaAnoAplicacao}` : '—')}
                    </span>
                    {extractionResult.metadata?.evidenceSources?.find(e => e.field === 'anoPublicacao') && (
                      <div className="text-[10px] text-stone-500 font-mono truncate">
                        Pág. {extractionResult.metadata.evidenceSources.find(e => e.field === 'anoPublicacao')?.pageNumber}: "{extractionResult.metadata.evidenceSources.find(e => e.field === 'anoPublicacao')?.sourceText}"
                      </div>
                    )}
                  </div>

                  {/* Campo 6: Modalidade */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase text-stone-500 font-bold">Modalidade</span>
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        extractionResult.metadata?.modalidadeState === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {metaModalidade ? (extractionResult.metadata?.modalidadeState || 'CONFIRMADA') : 'PENDENTE'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-neutral-900 block truncate" title={metaModalidade || 'Não detectada'}>
                      {metaModalidade || '— Não detectada —'}
                    </span>
                    {extractionResult.metadata?.evidenceSources?.find(e => e.field === 'modalidade') && (
                      <div className="text-[10px] text-stone-500 font-mono truncate">
                        Pág. {extractionResult.metadata.evidenceSources.find(e => e.field === 'modalidade')?.pageNumber}: "{extractionResult.metadata.evidenceSources.find(e => e.field === 'modalidade')?.sourceText}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Especialidades Detectadas nas Questões */}
                {extractionResult.metadata?.especialidadesList && extractionResult.metadata.especialidadesList.length > 0 && (
                  <div className="p-2.5 bg-sky-50/70 border border-sky-200 rounded-lg text-xs font-mono flex flex-wrap items-center gap-2">
                    <span className="text-sky-900 font-bold uppercase text-[10px]">Especialidades Detectadas nas Questões:</span>
                    <div className="flex flex-wrap gap-1">
                      {extractionResult.metadata.especialidadesList.map((esp, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-white text-sky-800 border border-sky-200 text-[10px] font-bold">
                          {esp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status da Procedência do Gabarito */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-stone-100 rounded-lg border border-stone-200 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 font-bold uppercase text-[10px]">Procedência do Gabarito:</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      extractionResult.metadata?.isGabaritoOficialComprovado
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {extractionResult.metadata?.isGabaritoOficialComprovado ? 'OFICIAL COMPROVADO' : 'DOCUMENTAL (ENCONTRADO NO DOCUMENTO)'}
                    </span>
                  </div>

                  {extractionResult.metadata?.conflicts && extractionResult.metadata.conflicts.length > 0 && (
                    <span className="text-amber-800 font-bold flex items-center gap-1 text-[11px]">
                      <AlertTriangle size={13} className="text-amber-600" />
                      {extractionResult.metadata.conflicts.length} conflito(s) entre metadados sinalizado(s) para revisão
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Painel Expansível de Evidências Documentais */}
            {showEvidenceModal && extractionResult.metadata?.evidenceSources && (
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs font-mono">
                <span className="font-bold text-neutral-800 uppercase text-[10px] block">
                  Evidências Encontradas no Documento:
                </span>
                <div className="space-y-1.5">
                  {extractionResult.metadata.evidenceSources.map((ev, i) => (
                    <div key={i} className="p-2 bg-white rounded border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-700 text-[10px] font-bold uppercase">
                          {ev.field}
                        </span>
                        <span className="font-bold text-neutral-900">{ev.value}</span>
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-2">
                        <span>Pág. {ev.pageNumber}</span>
                        <span className="text-stone-300">|</span>
                        <span className="italic truncate max-w-xs text-stone-600">"{ev.sourceText}"</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeFilter === 'ALL' ? 'bg-neutral-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                Todas ({extractionResult.questions.length})
              </button>

              <button
                onClick={() => setActiveFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeFilter === 'PENDING' ? 'bg-neutral-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                Pendentes ({extractionResult.questions.filter(q => q.reviewStatus === 'PENDING').length})
              </button>

              <button
                onClick={() => setActiveFilter('ALERTS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeFilter === 'ALERTS' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                Com Alertas ({extractionResult.questions.filter(q => q.validationAlerts.length > 0).length})
              </button>

              <button
                onClick={() => setActiveFilter('APPROVED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeFilter === 'APPROVED' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                Aprovadas ({extractionResult.questions.filter(q => q.reviewStatus === 'APPROVED').length})
              </button>

              <button
                onClick={() => setActiveFilter('REJECTED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeFilter === 'REJECTED' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                Rejeitadas ({extractionResult.questions.filter(q => q.reviewStatus === 'REJECTED').length})
              </button>

              <button
                onClick={() => setActiveFilter('ANULADA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeFilter === 'ANULADA' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
                }`}
              >
                Anuladas ({extractionResult.questions.filter(q => q.gabarito?.isAnulada).length})
              </button>
            </div>

            {/* Campo de Busca */}
            <div className="relative min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar por Nº ou termo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
          </div>

          {/* Layout Principal: Lista Lateral de Questões + Painel de Conferência Dividido */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Coluna 1: Lista Compacta de Questões (3 colunas) */}
            <div className="lg:col-span-3 bg-white border border-[#E2E0D9] rounded-2xl p-3 shadow-sm max-h-[780px] overflow-y-auto space-y-1.5">
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-stone-500 font-bold flex justify-between">
                <span>Questões ({filteredQuestions.length})</span>
                <span>Gabarito</span>
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="p-4 text-center text-xs font-mono text-stone-400">
                  Nenhuma questão encontrada com este filtro.
                </div>
              ) : (
                filteredQuestions.map((q) => {
                  const isSelected = q.id === selectedQuestionId;
                  const hasAlerts = q.validationAlerts.length > 0;
                  const isApproved = q.reviewStatus === 'APPROVED';
                  const isRejected = q.reviewStatus === 'REJECTED';

                  return (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuestionId(q.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                          : isApproved
                            ? 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200 text-neutral-900'
                            : isRejected
                              ? 'bg-rose-50/50 hover:bg-rose-50 border-rose-200 text-neutral-900'
                              : hasAlerts
                                ? 'bg-amber-50/40 hover:bg-amber-50 border-amber-200 text-neutral-900'
                                : 'bg-white hover:bg-stone-50 border-stone-200 text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-xs ${
                          isSelected ? 'bg-white text-neutral-900' : 'bg-stone-100 text-neutral-700'
                        }`}>
                          {q.questionNumber}
                        </span>

                        <div className="space-y-0.5">
                          <span className="text-[11px] font-mono block">
                            Pág. {q.sourcePages.join(', ')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasAlerts && (
                          <AlertTriangle size={14} className={isSelected ? 'text-amber-300' : 'text-amber-500'} />
                        )}

                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          q.gabarito?.isAnulada 
                            ? isSelected ? 'bg-indigo-400 text-neutral-900' : 'bg-indigo-100 text-indigo-800'
                            : q.gabarito?.answerLetter
                              ? isSelected ? 'bg-white text-neutral-900' : 'bg-stone-100 text-neutral-800 border border-stone-200'
                              : isSelected ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-400'
                        }`}>
                          {q.gabarito?.isAnulada ? 'NULA' : q.gabarito?.answerLetter || 'S/G'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Coluna 2: Detalhes da Questão + Visualizador da Página Original do PDF (9 colunas) */}
            {selectedQuestion ? (
              <div className="lg:col-span-9 space-y-6">
                {/* Barra de Ações da Questão Selecionada */}
                <div className="p-4 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-neutral-900 text-white font-mono font-bold text-sm flex items-center justify-center">
                      {selectedQuestion.questionNumber}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-neutral-900">
                        Questão nº {selectedQuestion.questionNumber}
                      </h4>
                      <span className="text-[10px] font-mono text-stone-500">
                        Página(s) de Origem: {selectedQuestion.sourcePages.join(', ')} | Tipo: {selectedQuestion.questionType}
                      </span>
                    </div>
                  </div>

                  {/* Status atual e Ações de Moderação */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                      selectedQuestion.reviewStatus === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : selectedQuestion.reviewStatus === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : selectedQuestion.reviewStatus === 'NEEDS_REVIEW'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-stone-100 text-stone-700 border border-stone-200'
                    }`}>
                      Status: {selectedQuestion.reviewStatus}
                    </span>

                    <button
                      onClick={() => updateQuestionStatus(selectedQuestion.id, 'APPROVED')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                    >
                      <Check size={14} />
                      <span>Aprovar</span>
                    </button>

                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-neutral-800 border border-stone-300 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1"
                    >
                      <Edit3 size={14} />
                      <span>{isEditing ? 'Cancelar Edição' : 'Editar'}</span>
                    </button>

                    <button
                      onClick={() => updateQuestionStatus(selectedQuestion.id, 'NEEDS_REVIEW')}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1"
                    >
                      <AlertOctagon size={14} />
                      <span>Revisão</span>
                    </button>

                    <button
                      onClick={() => updateQuestionStatus(selectedQuestion.id, 'REJECTED')}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1"
                    >
                      <X size={14} />
                      <span>Rejeitar</span>
                    </button>
                  </div>
                </div>

                {/* Alertas de Inconsistência da Questão (Item 4) */}
                {selectedQuestion.validationAlerts.length > 0 && (
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
                    <span className="text-xs font-mono font-bold uppercase text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-600" />
                      Alertas de Validação Automática:
                    </span>
                    <ul className="space-y-1.5 text-xs text-amber-900 font-sans">
                      {selectedQuestion.validationAlerts.map((alert, idx) => (
                        <li key={idx} className="flex items-start gap-2 bg-white/70 p-2 rounded-lg border border-amber-200/60">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                            alert.severity === 'WARNING' ? 'bg-amber-200 text-amber-900' : 'bg-blue-100 text-blue-900'
                          }`}>
                            {alert.code}
                          </span>
                          <span className="leading-tight">{alert.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Elementos Editoriais Higienizados da Questão */}
                {selectedQuestion.removedArtifacts && selectedQuestion.removedArtifacts.length > 0 && (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 uppercase text-[10px] flex items-center gap-1.5">
                        <Sparkles size={13} className="text-emerald-700" />
                        Limpeza Editorial Automática ({selectedQuestion.removedArtifacts.length} item(ns) removido(s)):
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 font-bold">
                        Enunciado Higienizado
                      </span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-emerald-950 font-sans">
                      {selectedQuestion.removedArtifacts.map((art, idx) => (
                        <li key={idx} className="truncate">
                          • {art}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Painel Duplo: Texto Extraído vs Gabarito Extraído */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Bloco 1: Enunciado e Alternativas */}
                  <div className="p-5 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E2E0D9]/70">
                      <div className="flex items-center gap-2">
                        <FileText size={14} />
                        <h4 className="text-xs font-mono uppercase font-bold text-neutral-900">
                          Enunciado da Questão
                        </h4>
                        {selectedQuestion.extractedTag?.titulo && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-mono font-bold">
                            Título: {selectedQuestion.extractedTag.titulo}
                          </span>
                        )}
                      </div>

                      {/* Alternador de Modo de Visualização: Limpo vs Bruto vs Comparação */}
                      {!isEditing && (
                        <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-[10px] font-mono font-bold">
                          <button
                            type="button"
                            onClick={() => setStatementViewMode('CLEAN')}
                            className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                              statementViewMode === 'CLEAN'
                                ? 'bg-white text-neutral-900 shadow-xs'
                                : 'text-stone-600 hover:text-neutral-900'
                            }`}
                          >
                            Enunciado Limpo
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatementViewMode('RAW')}
                            className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                              statementViewMode === 'RAW'
                                ? 'bg-white text-neutral-900 shadow-xs'
                                : 'text-stone-600 hover:text-neutral-900'
                            }`}
                          >
                            Texto Bruto (Auditoria)
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatementViewMode('COMPARE')}
                            className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                              statementViewMode === 'COMPARE'
                                ? 'bg-white text-neutral-900 shadow-xs'
                                : 'text-stone-600 hover:text-neutral-900'
                            }`}
                          >
                            Comparar Lado a Lado
                          </button>
                        </div>
                      )}

                      {selectedQuestion.adminModifications && (
                        <span className="text-[9px] font-mono px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                          Modificado pelo Admin
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      /* Formulário de Edição Preservando Rastreabilidade */
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase font-bold text-stone-500">Enunciado:</label>
                          <textarea
                            value={editStatement}
                            onChange={(e) => setEditStatement(e.target.value)}
                            rows={6}
                            className="w-full p-2.5 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-mono uppercase font-bold text-stone-500">Alternativas:</label>
                          {editAlternatives.map((alt, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="w-6 h-6 rounded bg-stone-100 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                {alt.letter}
                              </span>
                              <input
                                type="text"
                                value={alt.text}
                                onChange={(e) => {
                                  const updated = [...editAlternatives];
                                  updated[idx] = { ...alt, text: e.target.value };
                                  setEditAlternatives(updated);
                                }}
                                className="w-full p-1.5 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="text-[10px] font-mono uppercase font-bold text-stone-500">Letra Gabarito:</label>
                            <input
                              type="text"
                              maxLength={1}
                              value={editGabaritoLetter}
                              onChange={(e) => setEditGabaritoLetter(e.target.value.toUpperCase())}
                              className="w-full p-1.5 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg uppercase"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase font-bold text-stone-500">Observações:</label>
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Motivo do ajuste..."
                              className="w-full p-1.5 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs font-mono font-bold"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={saveAdminEdits}
                            className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-mono font-bold shadow-xs"
                          >
                            Salvar Alterações
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Visualização Fiel em Modo Somente-Leitura */
                      <div className="space-y-4">
                        {/* Metadados Estruturados da Questão Exibidos no Topo (Tags Separadas do Enunciado) */}
                        {selectedQuestion.extractedTag && (
                          <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-stone-100">
                            {selectedQuestion.extractedTag.ano && (
                              <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-800 text-[10px] font-mono font-bold border border-stone-200">
                                Ano: {selectedQuestion.extractedTag.ano}
                              </span>
                            )}
                            {selectedQuestion.extractedTag.banca && (
                              <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-800 text-[10px] font-mono font-bold border border-stone-200">
                                Banca: {selectedQuestion.extractedTag.banca}
                              </span>
                            )}
                            {selectedQuestion.extractedTag.institution && (
                              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-mono font-bold border border-purple-200">
                                Instituição: {selectedQuestion.extractedTag.institution}
                              </span>
                            )}
                            {selectedQuestion.extractedTag.uf && (
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-mono font-bold border border-amber-200">
                                UF: {selectedQuestion.extractedTag.uf}
                              </span>
                            )}
                            {selectedQuestion.extractedTag.natureza && (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold border border-emerald-200">
                                Natureza: {selectedQuestion.extractedTag.natureza}
                              </span>
                            )}
                            {selectedQuestion.extractedTag.modalidade && (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] font-mono font-bold border border-indigo-200">
                                Modalidade: {selectedQuestion.extractedTag.modalidade}
                              </span>
                            )}
                            {selectedQuestion.extractedTag.especialidade && (
                              <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-mono font-bold border border-sky-200">
                                Especialidade: {selectedQuestion.extractedTag.especialidade}
                              </span>
                            )}
                            {selectedQuestion.extractedTag.disciplina && (
                              <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 text-[10px] font-mono font-bold border border-teal-200">
                                Disciplina: {selectedQuestion.extractedTag.disciplina}
                              </span>
                            )}
                            {selectedQuestion.extractedTag.assunto && (
                              <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 text-[10px] font-mono font-bold border border-cyan-200">
                                Assunto: {selectedQuestion.extractedTag.assunto}
                              </span>
                            )}
                            {selectedQuestion.extractedTag.plataformaCodigo && (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-mono font-bold border border-amber-200">
                                Cód. Plataforma: {selectedQuestion.extractedTag.plataformaCodigo}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Visualização de Conteúdo Baseada no Modo Selecionado */}
                        {statementViewMode === 'CLEAN' ? (
                          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                            <span className="text-[10px] font-mono uppercase text-stone-500 font-bold block">
                              Enunciado Limpo:
                            </span>
                            <p className="text-xs text-neutral-900 leading-relaxed whitespace-pre-line font-sans">
                              {selectedQuestion.statement}
                            </p>
                          </div>
                        ) : statementViewMode === 'RAW' ? (
                          <div className="p-3 bg-stone-900 rounded-xl border border-stone-800 text-stone-100 space-y-1 font-mono">
                            <div className="flex items-center justify-between pb-1 border-b border-stone-800">
                              <span className="text-[10px] uppercase text-stone-400 font-bold">
                                Texto Bruto Original Extraído (rawStatement - Não Modificado):
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 bg-stone-800 text-stone-300 rounded font-bold">
                                Auditoria Integral
                              </span>
                            </div>
                            <pre className="text-xs leading-relaxed whitespace-pre-line overflow-x-auto text-stone-200 font-mono">
                              {selectedQuestion.rawStatement || selectedQuestion.statement}
                            </pre>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 bg-stone-900 rounded-xl border border-stone-800 text-stone-100 space-y-1 font-mono">
                              <span className="text-[10px] uppercase text-stone-400 font-bold block border-b border-stone-800 pb-1">
                                Texto Bruto Original (rawStatement):
                              </span>
                              <pre className="text-[11px] leading-relaxed whitespace-pre-line overflow-x-auto text-stone-300">
                                {selectedQuestion.rawStatement || selectedQuestion.statement}
                              </pre>
                            </div>
                            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                              <span className="text-[10px] font-mono uppercase text-stone-500 font-bold block border-b border-stone-200 pb-1">
                                Enunciado Limpo (statement):
                              </span>
                              <p className="text-xs text-neutral-900 leading-relaxed whitespace-pre-line font-sans">
                                {selectedQuestion.statement}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Lista de Alternativas */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono uppercase text-stone-500 font-bold block">
                            Alternativas Extraídas ({selectedQuestion.alternatives.length}):
                          </span>
                          {selectedQuestion.alternatives.map((alt) => {
                            const isCorrectLetter = selectedQuestion.gabarito?.answerLetter?.toUpperCase() === alt.letter.toUpperCase();
                            return (
                              <div 
                                key={alt.letter}
                                className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                                  isCorrectLetter
                                    ? 'bg-emerald-50 border-emerald-300'
                                    : 'bg-white border-stone-200'
                                }`}
                              >
                                <span className={`w-6 h-6 rounded-md font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                                  isCorrectLetter
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-stone-100 text-stone-800'
                                }`}>
                                  {alt.letter}
                                </span>
                                <span className="text-xs text-neutral-800 leading-relaxed font-sans pt-0.5">
                                  {alt.text}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bloco 2: Gabarito Oficial Extraído das Páginas Finais (Item 3 da Especificação) */}
                  <div className="p-5 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E2E0D9]/70">
                      <h4 className="text-xs font-mono uppercase font-bold text-neutral-900 flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        Gabarito Oficial Extraído do Documento
                      </h4>
                      <span className="text-[9px] font-mono px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-200 rounded">
                        Fonte: Documental
                      </span>
                    </div>

                    {selectedQuestion.gabarito ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-mono uppercase text-stone-500 block">Resposta Oficial (correctAnswer)</span>
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-display font-black text-neutral-900">
                                {selectedQuestion.correctAnswer || (selectedQuestion.gabarito.isAnulada 
                                  ? 'ANULADA' 
                                  : selectedQuestion.gabarito.answerLetter || 'Pendente')}
                              </span>
                              {selectedQuestion.gabarito.isRetificada && (
                                <span className="text-xs font-mono text-amber-600 font-bold">(Retificada)</span>
                              )}
                              {selectedQuestion.gabarito.isAnulada && (
                                <span className="text-xs font-mono text-indigo-600 font-bold">(Nula/Anulada)</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-mono uppercase text-stone-500 block">Página no PDF</span>
                            <span className="text-lg font-mono font-bold text-neutral-800">
                              Pág. {selectedQuestion.gabarito.pageNumber}
                            </span>
                          </div>
                        </div>

                        {/* Trecho Bruto Original que Fundamenta a Associação */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-mono uppercase text-stone-500 font-bold block">
                            Trecho Bruto Original (Evidência Documental):
                          </span>
                          <div className="p-3 bg-stone-900 text-stone-100 rounded-xl font-mono text-[11px] overflow-x-auto">
                            <code>{selectedQuestion.gabarito.rawSnippet}</code>
                          </div>
                        </div>

                        {/* Botão para saltar o visualizador para a página do gabarito */}
                        <button
                          onClick={() => setViewingPage(selectedQuestion.gabarito!.pageNumber)}
                          className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-neutral-800 border border-stone-300 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                        >
                          <Eye size={14} />
                          <span>Ver Página do Gabarito no PDF (Pág. {selectedQuestion.gabarito.pageNumber})</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                        <AlertTriangle size={24} className="text-amber-600 mx-auto" />
                        <h5 className="text-xs font-bold text-amber-900">Nenhum gabarito encontrado para a questão nº {selectedQuestion.questionNumber}</h5>
                        <p className="text-[11px] text-amber-800">
                          A questão foi registrada como pendente de resposta. O gabarito não foi inventado nem preenchido por inteligência artificial.
                        </p>
                      </div>
                    )}

                    {/* Informações de Rastreabilidade Técnica */}
                    <div className="pt-2 border-t border-stone-100 space-y-1 text-[10px] font-mono text-stone-500">
                      <div>Hash Canônico (SHA-256): <span className="text-stone-700">{selectedQuestion.id}</span></div>
                      <div>Associação: Por número original ({selectedQuestion.questionNumber})</div>
                    </div>
                  </div>
                </div>

                {/* Visualizador da Página Original do PDF (Item 5 da Especificação) */}
                <div className="p-5 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E0D9]/70">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-mono uppercase font-bold text-neutral-900 flex items-center gap-2">
                        <Eye size={14} />
                        Visualização da Página Original do PDF
                      </h4>
                      <span className="text-[11px] font-mono px-2 py-0.5 bg-stone-100 text-stone-800 border border-stone-200 rounded font-bold">
                        Página {viewingPage} de {pdfProxy?.numPages || extractionResult.summary.totalPages}
                      </span>
                    </div>

                    {/* Controles de Navegação e Zoom */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingPage(Math.max(1, viewingPage - 1))}
                        disabled={viewingPage <= 1}
                        className="p-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
                        title="Página Anterior"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <button
                        onClick={() => setViewingPage(Math.min(pdfProxy?.numPages || 1, viewingPage + 1))}
                        disabled={viewingPage >= (pdfProxy?.numPages || 1)}
                        className="p-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
                        title="Próxima Página"
                      >
                        <ChevronRight size={16} />
                      </button>

                      <div className="h-4 w-px bg-stone-200 mx-1" />

                      <button
                        onClick={() => setZoomScale(Math.max(0.8, zoomScale - 0.2))}
                        className="p-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 cursor-pointer"
                        title="Diminuir Zoom"
                      >
                        <ZoomOut size={16} />
                      </button>

                      <span className="text-[10px] font-mono text-stone-600 font-bold min-w-[40px] text-center">
                        {Math.round(zoomScale * 100)}%
                      </span>

                      <button
                        onClick={() => setZoomScale(Math.min(2.5, zoomScale + 0.2))}
                        className="p-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 cursor-pointer"
                        title="Aumentar Zoom"
                      >
                        <ZoomIn size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Área do Canvas Renderizado */}
                  <div className="bg-stone-100 rounded-xl border border-stone-200 p-4 overflow-auto max-h-[600px] flex items-center justify-center relative">
                    {isRenderingPage && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
                        <RefreshCw size={24} className="animate-spin text-[#D44E3D]" />
                      </div>
                    )}
                    
                    {pdfProxy ? (
                      <canvas ref={canvasRef} className="shadow-md rounded border border-stone-300 max-w-full" />
                    ) : (
                      <div className="p-8 text-center text-xs font-mono text-stone-400">
                        Visualização de canvas disponível ao carregar o arquivo PDF no navegador.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-9 p-12 bg-white border border-[#E2E0D9] rounded-2xl text-center space-y-2">
                <FileSearch size={32} className="mx-auto text-stone-400" />
                <h4 className="text-sm font-bold text-neutral-800">Selecione uma questão ao lado</h4>
                <p className="text-xs text-stone-500">
                  Clique em qualquer item da lista de questões para inspecionar os enunciados, alternativas, evidências do gabarito e a página original do PDF.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
