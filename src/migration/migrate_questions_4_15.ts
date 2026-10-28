/**
 * ==============================================================================
 * MEDREVISE — SCRIPT DE MIGRAÇÃO CONTROLADA 4.15 (VERSÃO CORRIGIDA)
 * Arquivo: src/migration/migrate_questions_4_15.ts
 *
 * PONTOS CRÍTICOS IMPLEMENTADOS:
 * 1. Chamada RPC qualificada explicitamente com o schema `medrevise_staging`
 *    através da opção `schema: 'medrevise_staging'` no cliente Supabase.
 * 2. Hash canônico completo (SHA-256) incluindo todos os campos semânticos.
 * 3. Validação antecipada e rigorosa de `batchSize` (> 0 e <= 500).
 * 4. Tratamento robusto das respostas da RPC sem falhas silenciosas.
 * 5. Rollback atômico condicionado estritamente às questões criadas pelo lote.
 * ==============================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

export interface AlternativePayload {
  label: string;
  text: string;
  order_index: number;
}

export interface StagingQuestionInput {
  id: string;
  statement: string;
  questionType: 'OBJECTIVE' | 'DISCURSIVE';
  isDiscursive: boolean;
  correctOptionIndex: number | null;
  correctAnswer: string | null;
  alternatives: AlternativePayload[] | null;
  explanation: string | null;
  topic: string | null;
  subSubject: string | null;
  sourceDocumentId: string;
  contentHash: string;
}

export interface MigrationConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  batchSize: number;
  dryRun: boolean;
}

export interface MigrationSummary {
  batchId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'ROLLED_BACK';
  isDryRun: boolean;
  totalFound: number;
  insertedCount: number;
  identicalCount: number;
  conflictCount: number;
  rejectedCount: number;
  errorCount: number;
  details: Array<{
    questionId: string;
    status: string;
    message?: string;
  }>;
}

/**
 * Gera hash SHA-256 canônico cobrindo todos os atributos da questão.
 */
export function computeCanonicalHash(q: {
  id: string;
  statement: string;
  questionType: 'OBJECTIVE' | 'DISCURSIVE';
  isDiscursive: boolean;
  correctOptionIndex: number | null;
  correctAnswer: string | null;
  alternatives: AlternativePayload[] | null;
  explanation: string | null;
  topic: string | null;
  subSubject: string | null;
}): string {
  const normalizedAlternatives = (q.alternatives || [])
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map(alt => ({
      label: alt.label.trim(),
      text: alt.text.trim(),
      order_index: alt.order_index
    }));

  const canonicalPayload = {
    id: q.id.trim(),
    statement: q.statement.trim(),
    questionType: q.questionType,
    isDiscursive: q.isDiscursive,
    correctOptionIndex: q.correctOptionIndex,
    correctAnswer: q.correctAnswer ? q.correctAnswer.trim() : null,
    alternatives: normalizedAlternatives,
    explanation: q.explanation ? q.explanation.trim() : null,
    topic: q.topic ? q.topic.trim() : null,
    subSubject: q.subSubject ? q.subSubject.trim() : null,
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalPayload), 'utf8')
    .digest('hex');
}

/**
 * Cria ou obtém o cliente Supabase configurado para o schema `medrevise_staging`.
 */
export function getStagingSupabaseClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient<any, 'medrevise_staging'> {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL e Service Role Key são estritamente obrigatórios para migração de staging.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'medrevise_staging'
    }
  });
}

/**
 * Validação dos dados brutos legados de `firestore_documents`.
 */
export function parseAndValidateLegacyQuestion(docId: string, rawData: any): StagingQuestionInput | { error: string } {
  if (!rawData || typeof rawData !== 'object') {
    return { error: 'Document data ausente ou inválido.' };
  }

  const statement = typeof rawData.statement === 'string' && rawData.statement.trim() !== ''
    ? rawData.statement.trim()
    : typeof rawData.text === 'string' && rawData.text.trim() !== ''
      ? rawData.text.trim()
      : typeof rawData.enunciado === 'string' && rawData.enunciado.trim() !== ''
        ? rawData.enunciado.trim()
        : '';
  if (!statement) {
    return { error: 'Enunciado (statement/text/enunciado) ausente ou vazio.' };
  }

  // Identificação confiável de tipo: não aceita inferência solta
  const isDiscursiveExplicit = rawData.isDiscursive === true || rawData.type === 'DISCURSIVE';
  const hasOptionsArray = Array.isArray(rawData.options) && rawData.options.length > 0;

  let questionType: 'OBJECTIVE' | 'DISCURSIVE';
  let isDiscursive: boolean;
  let alternatives: AlternativePayload[] | null = null;
  let correctOptionIndex: number | null = null;

  if (isDiscursiveExplicit) {
    if (hasOptionsArray) {
      return { error: 'Incoerência: questão classificada como DISCURSIVE possui array de opções preenchido.' };
    }
    questionType = 'DISCURSIVE';
    isDiscursive = true;
    alternatives = null;
    correctOptionIndex = null;
  } else {
    questionType = 'OBJECTIVE';
    isDiscursive = false;

    if (!hasOptionsArray || rawData.options.length < 2) {
      return { error: 'Questão objetiva sem alternativas suficientes (mínimo 2 opções exigidas).' };
    }

    if (rawData.correctOptionIndex === undefined || rawData.correctOptionIndex === null) {
      return { error: 'Questão objetiva sem correctOptionIndex especificado.' };
    }

    const parsedIndex = Number(rawData.correctOptionIndex);
    if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex >= rawData.options.length) {
      return { error: `correctOptionIndex (${rawData.correctOptionIndex}) inválido para lista de ${rawData.options.length} alternativas.` };
    }
    correctOptionIndex = parsedIndex;

    const parsedAlts: AlternativePayload[] = [];
    for (let i = 0; i < rawData.options.length; i++) {
      const opt = rawData.options[i];
      let label = '';
      let text = '';

      if (typeof opt === 'string') {
        label = String.fromCharCode(65 + i); // 'A', 'B', 'C'...
        text = opt.trim();
      } else if (typeof opt === 'object' && opt !== null) {
        label = typeof opt.label === 'string' ? opt.label.trim() : String.fromCharCode(65 + i);
        text = typeof opt.text === 'string' ? opt.text.trim() : '';
      }

      if (!text) {
        return { error: `Alternativa no índice ${i} possui texto vazio.` };
      }

      parsedAlts.push({
        label,
        text,
        order_index: i + 1, // 1-based sequential
      });
    }
    alternatives = parsedAlts;
  }

  const correctAnswer = typeof rawData.correctAnswer === 'string' ? rawData.correctAnswer.trim() : null;
  const explanation = typeof rawData.explanation === 'string' ? rawData.explanation.trim() : null;
  const topic = typeof rawData.topic === 'string' && rawData.topic.trim() !== ''
    ? rawData.topic.trim()
    : typeof rawData.topicId === 'string' && rawData.topicId.trim() !== ''
      ? rawData.topicId.trim()
      : null;
  const subSubject = typeof rawData.subSubject === 'string' && rawData.subSubject.trim() !== ''
    ? rawData.subSubject.trim()
    : typeof rawData.subjectId === 'string' && rawData.subjectId.trim() !== ''
      ? rawData.subjectId.trim()
      : null;

  const contentHash = computeCanonicalHash({
    id: docId,
    statement,
    questionType,
    isDiscursive,
    correctOptionIndex,
    correctAnswer,
    alternatives,
    explanation,
    topic,
    subSubject,
  });

  return {
    id: docId,
    statement,
    questionType,
    isDiscursive,
    correctOptionIndex,
    correctAnswer,
    alternatives,
    explanation,
    topic,
    subSubject,
    sourceDocumentId: docId,
    contentHash,
  };
}

/**
 * Orquestrador principal da migração.
 */
export async function runControlledMigration(config: MigrationConfig): Promise<MigrationSummary> {
  // 1. Validação estrita dos parâmetros do runner
  if (!Number.isInteger(config.batchSize) || config.batchSize <= 0 || config.batchSize > 500) {
    throw new Error(`Tamanho de lote (batchSize) inválido: ${config.batchSize}. Deve ser um inteiro entre 1 e 500.`);
  }

  const client = getStagingSupabaseClient(config.supabaseUrl, config.supabaseServiceRoleKey);

  // --------------------------------------------------------------------------
  // CAMINHO 1: MODO SIMULAÇÃO (dryRun === true)
  // Estritamente livre de efeitos colaterais e escritas no banco:
  // - Não cria registro em migration_batches
  // - Não grava em migration_audit_log
  // - Não invoca RPCs com batch_id fictício nem executa escrita em questions
  // - Realiza leitura da origem, validações de payload e inspeção de idêntico/conflito
  // --------------------------------------------------------------------------
  if (config.dryRun) {
    const summary: MigrationSummary = {
      batchId: 'DRY_RUN_SIMULATION',
      status: 'COMPLETED',
      isDryRun: true,
      totalFound: 0,
      insertedCount: 0,
      identicalCount: 0,
      conflictCount: 0,
      rejectedCount: 0,
      errorCount: 0,
      details: [],
    };

    // Leitura somente-leitura da origem legada (firestore_documents no schema public)
    const { data: legacyRecords, error: fetchError } = await client
      .schema('public')
      .from('firestore_documents')
      .select('id, data')
      .eq('collection', 'questions')
      .limit(config.batchSize);

    if (fetchError) {
      throw new Error(`Erro ao consultar firestore_documents: ${fetchError.message}`);
    }

    const records = legacyRecords || [];
    summary.totalFound = records.length;

    for (const record of records) {
      const parsed = parseAndValidateLegacyQuestion(record.id, record.data);

      if ('error' in parsed) {
        summary.rejectedCount++;
        summary.details.push({
          questionId: record.id,
          status: 'REJECTED_REVIEW',
          message: parsed.error,
        });
        continue;
      }

      // Consulta de leitura para verificar existência prévia e comparar hashes sem disparar RPC/escritas
      const { data: existingQuestion, error: existingError } = await client
        .from('questions')
        .select('id, content_hash')
        .eq('id', parsed.id)
        .maybeSingle();

      if (existingError) {
        summary.errorCount++;
        summary.details.push({
          questionId: parsed.id,
          status: 'ERROR',
          message: `Erro ao verificar existência da questão: ${existingError.message}`,
        });
        continue;
      }

      if (existingQuestion) {
        if (existingQuestion.content_hash === parsed.contentHash) {
          summary.identicalCount++;
          summary.details.push({
            questionId: parsed.id,
            status: 'IDENTICAL_MATCH',
            message: 'Registro já existente possui conteúdo rigorosamente idêntico.',
          });
        } else {
          summary.conflictCount++;
          summary.details.push({
            questionId: parsed.id,
            status: 'CONTENT_CONFLICT',
            message: 'ID já existente com conteúdo divergente. Sobrescrita recusada por segurança.',
          });
        }
      } else {
        summary.insertedCount++;
        summary.details.push({
          questionId: parsed.id,
          status: 'INSERT_SIMULATED',
        });
      }
    }

    // Classificação determinística do resultado da simulação
    const hasErrors = summary.errorCount > 0;
    const hasUnresolved = summary.conflictCount > 0 || summary.rejectedCount > 0;
    const totalSuccessful = summary.insertedCount + summary.identicalCount;

    if (hasErrors && totalSuccessful === 0 && summary.totalFound > 0) {
      summary.status = 'FAILED';
    } else if (hasErrors || hasUnresolved) {
      summary.status = 'PARTIAL';
    } else {
      summary.status = 'COMPLETED';
    }

    return summary;
  }

  // --------------------------------------------------------------------------
  // CAMINHO 2: MODO REAL (dryRun === false)
  // Criação de lote, bloqueios transacionais de concorrência, RPC atômico e auditoria.
  // --------------------------------------------------------------------------
  const { data: batchData, error: batchError } = await client
    .from('migration_batches')
    .insert({
      status: 'RUNNING',
      is_dry_run: false,
      metadata: { initiatedBy: 'CLI_RUNNER_4_15', dryRun: false, batchSize: config.batchSize }
    })
    .select('batch_id')
    .single();

  if (batchError || !batchData?.batch_id) {
    throw new Error(`Falha ao registrar novo lote de migração: ${batchError?.message || 'Erro desconhecido'}`);
  }

  const batchId = batchData.batch_id as string;

  const summary: MigrationSummary = {
    batchId,
    status: 'COMPLETED',
    isDryRun: false,
    totalFound: 0,
    insertedCount: 0,
    identicalCount: 0,
    conflictCount: 0,
    rejectedCount: 0,
    errorCount: 0,
    details: [],
  };

  try {
    // Leitura da Origem Legada (firestore_documents com collection = 'questions')
    const { data: legacyRecords, error: fetchError } = await client
      .schema('public')
      .from('firestore_documents')
      .select('id, data')
      .eq('collection', 'questions')
      .limit(config.batchSize);

    if (fetchError) {
      throw new Error(`Erro ao consultar firestore_documents: ${fetchError.message}`);
    }

    const records = legacyRecords || [];
    summary.totalFound = records.length;

    // Processamento Registro a Registro
    for (const record of records) {
      const parsed = parseAndValidateLegacyQuestion(record.id, record.data);

      if ('error' in parsed) {
        summary.rejectedCount++;
        summary.details.push({
          questionId: record.id,
          status: 'REJECTED_REVIEW',
          message: parsed.error,
        });

        // Registrar rejeição na auditoria
        await client.from('migration_audit_log').insert({
          batch_id: batchId,
          question_id: record.id,
          action: 'REJECTED_REVIEW',
          was_inserted_by_this_batch: false,
          details: { reason: parsed.error },
        });
        continue;
      }

      // Invocação da RPC medrevise_staging.upsert_question_atomic
      const { data: rpcResult, error: rpcError } = await client
        .rpc('upsert_question_atomic', {
          p_batch_id: batchId,
          p_question_id: parsed.id,
          p_statement: parsed.statement,
          p_question_type: parsed.questionType,
          p_is_discursive: parsed.isDiscursive,
          p_correct_option_index: parsed.correctOptionIndex,
          p_correct_answer: parsed.correctAnswer,
          p_alternatives: parsed.alternatives,
          p_explanation: parsed.explanation,
          p_topic: parsed.topic,
          p_sub_subject: parsed.subSubject,
          p_source_document_id: parsed.sourceDocumentId,
          p_content_hash: parsed.contentHash,
          p_dry_run: false,
        });

      if (rpcError) {
        summary.errorCount++;
        summary.details.push({
          questionId: parsed.id,
          status: 'ERROR',
          message: `RPC error: ${rpcError.message}`,
        });
        continue;
      }

      // Interpretação do Retorno Estruturado JSONB
      const status = rpcResult?.status;
      if (status === 'INSERTED') {
        summary.insertedCount++;
        summary.details.push({ questionId: parsed.id, status });
      } else if (status === 'IDENTICAL_MATCH') {
        summary.identicalCount++;
        summary.details.push({ questionId: parsed.id, status, message: rpcResult?.message });
      } else if (status === 'CONTENT_CONFLICT') {
        summary.conflictCount++;
        summary.details.push({ questionId: parsed.id, status, message: rpcResult?.message });
      } else {
        summary.errorCount++;
        summary.details.push({
          questionId: parsed.id,
          status: 'ERROR',
          message: rpcResult?.message || 'Status retornado desconhecido',
        });
      }
    }

    // Determinação e Atualização do Status Final do Lote
    let finalBatchStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED' = 'COMPLETED';

    const hasErrors = summary.errorCount > 0;
    const hasUnresolved = summary.conflictCount > 0 || summary.rejectedCount > 0;
    const totalSuccessful = summary.insertedCount + summary.identicalCount;

    if (hasErrors && totalSuccessful === 0 && summary.totalFound > 0) {
      finalBatchStatus = 'FAILED';
    } else if (hasErrors || hasUnresolved) {
      finalBatchStatus = 'PARTIAL';
    } else {
      finalBatchStatus = 'COMPLETED';
    }

    summary.status = finalBatchStatus;

    const { error: updateBatchError } = await client
      .from('migration_batches')
      .update({
        status: finalBatchStatus,
        finished_at: new Date().toISOString(),
        total_processed: summary.totalFound,
        inserted_count: summary.insertedCount,
        identical_count: summary.identicalCount,
        conflict_count: summary.conflictCount,
        rejected_count: summary.rejectedCount,
        error_count: summary.errorCount,
      })
      .eq('batch_id', batchId);

    if (updateBatchError) {
      throw new Error(`Falha ao registrar finalização do lote ${batchId}: ${updateBatchError.message}`);
    }

    return summary;
  } catch (err: any) {
    summary.status = 'FAILED';
    try {
      await client
        .from('migration_batches')
        .update({
          status: 'FAILED',
          finished_at: new Date().toISOString(),
          metadata: { failureReason: err?.message || String(err) }
        })
        .eq('batch_id', batchId);
    } catch {
      // Silencia falha secundária no catch para preservar a exceção original
    }
    throw err;
  }
}

/**
 * Executa o rollback seguro de um lote, removendo apenas registros criados por ele.
 */
export async function runRollbackBatch(
  supabaseUrl: string,
  serviceRoleKey: string,
  batchId: string
): Promise<{ success: boolean; deletedCount: number; skippedCount: number; message: string }> {
  const client = getStagingSupabaseClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await client.rpc('rollback_batch_atomic', {
    p_batch_id: batchId,
  });

  if (error) {
    throw new Error(`Falha no rollback do lote ${batchId}: ${error.message}`);
  }

  if (data?.success === false) {
    throw new Error(`Rollback recusado para lote ${batchId}: ${data?.message || data?.code || 'Erro desconhecido'}`);
  }

  return {
    success: !!data?.success,
    deletedCount: data?.deleted_count || 0,
    skippedCount: data?.skipped_count || 0,
    message: data?.message || 'Rollback processado com sucesso.',
  };
}

/**
 * Runner de linha de comando para execução controlada e segura no backend.
 */
async function runCli(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://jhttjndhjzpfphqxjiao.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Validação estrita da credencial de backend (sem fallback para anon)
  if (!serviceRoleKey || serviceRoleKey.trim() === '') {
    console.error('[ERRO CRÍTICO] A variável de ambiente SUPABASE_SERVICE_ROLE_KEY não foi informada.');
    console.error('A migração exige permissões de service_role exclusivamente no backend.');
    console.error('Por segurança, nenhum fallback para chave pública (anon) é permitido e nenhuma chave é logada.');
    process.exit(1);
  }

  // 2. Parâmetros de execução (garantindo limite do lote piloto de 30 questões)
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';

  let batchSize = 30;
  const batchArg = args.find(a => a.startsWith('--batch-size='));
  if (batchArg) {
    const parsedSize = parseInt(batchArg.split('=')[1], 10);
    if (!isNaN(parsedSize) && parsedSize > 0) {
      batchSize = parsedSize;
    }
  } else if (process.env.BATCH_SIZE) {
    const parsedSize = parseInt(process.env.BATCH_SIZE, 10);
    if (!isNaN(parsedSize) && parsedSize > 0) {
      batchSize = parsedSize;
    }
  }

  // Trava de segurança para o teste piloto: máximo 30 questões
  if (batchSize > 30 && process.env.ALLOW_UNLIMITED_BATCH !== 'true') {
    console.warn(`[PILOTO] Tamanho de lote solicitado (${batchSize}) ajustado para o teto piloto de 30 questões.`);
    batchSize = 30;
  }

  console.log('================================================================');
  console.log('MEDREVISE — EXECUÇÃO DA MIGRAÇÃO PILOTO DE QUESTÕES');
  console.log('================================================================');
  console.log(`Projeto Supabase : ${supabaseUrl}`);
  console.log(`Schema de Destino: medrevise_staging`);
  console.log(`Modo de Execução : ${isDryRun ? 'DRY-RUN (Simulação sem escritas)' : 'REAL (Escrita atômica persistida)'}`);
  console.log(`Tamanho do Lote  : ${batchSize} questões`);
  console.log(`Autenticação     : SUPABASE_SERVICE_ROLE_KEY (validada e protegida)`);
  console.log('----------------------------------------------------------------');

  try {
    const summary = await runControlledMigration({
      supabaseUrl,
      supabaseServiceRoleKey: serviceRoleKey,
      batchSize,
      dryRun: isDryRun,
    });

    console.log('----------------------------------------------------------------');
    console.log('RELATÓRIO DO LOTE PROCESSADO:');
    console.log(`  Identificador do Lote : ${summary.batchId}`);
    console.log(`  Status Final          : ${summary.status}`);
    console.log(`  Simulação (Dry-Run)   : ${summary.isDryRun}`);
    console.log(`  Total Lido na Origem  : ${summary.totalFound}`);
    console.log(`  Novas Inserções       : ${summary.insertedCount}`);
    console.log(`  Idênticos Confirmados : ${summary.identicalCount}`);
    console.log(`  Conflitos de Conteúdo : ${summary.conflictCount}`);
    console.log(`  Rejeitados p/ Revisão : ${summary.rejectedCount}`);
    console.log(`  Erros Encontrados     : ${summary.errorCount}`);
    console.log('================================================================');

    if (summary.errorCount > 0) {
      console.warn(`Atenção: Ocorreram ${summary.errorCount} erros durante o processamento.`);
      process.exit(summary.status === 'FAILED' ? 1 : 0);
    }
  } catch (err: any) {
    console.error('[FALHA NA EXECUÇÃO DA MIGRAÇÃO]:', err?.message || err);
    process.exit(1);
  }
}

// Invocação automática se executado como script principal via Node / tsx
if (
  process.argv[1] &&
  (process.argv[1].endsWith('migrate_questions_4_15.ts') || process.argv[1].endsWith('migrate_questions_4_15.js'))
) {
  runCli();
}
