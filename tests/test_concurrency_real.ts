/**
 * Teste de Integração Real: Concorrência entre Upsert e Rollback
 * Executa transações concorrentes reais com travamento a nível de linha.
 * 
 * Requisitos:
 * - PostgreSQL rodando (ex: DATABASE_URL ou variáveis PGHOST/PGUSER/PGPORT/PGDATABASE)
 * - Extensões e schema medrevise_staging aplicados (medrevise_staging_migration.sql)
 */

import { Client } from 'pg';

interface TestEnv {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

function getDbConfig(): TestEnv {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.PGHOST || '127.0.0.1',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres',
  };
}

export async function runRealConcurrencyTest(): Promise<void> {
  const config = getDbConfig();
  const client1 = new Client(config);
  const client2 = new Client(config);

  console.log('--- Teste de Integração Real de Concorrência ---');
  console.log('Conectando dois clientes independentes ao PostgreSQL...');

  try {
    await client1.connect();
    await client2.connect();
  } catch (err: any) {
    console.error('AVISO: Infraestrutura PostgreSQL não disponível no ambiente atual.');
    console.error(`Erro de conexão: ${err.message}`);
    console.log('\nPara executar este teste em um ambiente com PostgreSQL ativo:');
    console.log('1. docker run --name test-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16');
    console.log('2. psql -h localhost -U postgres -d postgres -f medrevise_staging_migration.sql');
    console.log('3. DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npx tsx tests/test_concurrency_real.ts\n');
    return;
  }

  try {
    // 1. Criar um lote limpo para teste
    const batchRes = await client1.query(`
      INSERT INTO medrevise_staging.migration_batches (status, is_dry_run, metadata)
      VALUES ('RUNNING', false, '{"test": "concurrency"}'::jsonb)
      RETURNING batch_id;
    `);
    const batchId = batchRes.rows[0].batch_id;
    console.log(`Lote de teste criado: ${batchId}`);

    // 2. Transação 1: Inicia transação e faz upsert com FOR SHARE na linha do lote
    await client1.query('BEGIN');
    console.log('Transação 1: Iniciada. Executando upsert_question_atomic (adquire FOR SHARE no lote)...');
    
    const upsertRes1 = await client1.query(`
      SELECT medrevise_staging.upsert_question_atomic(
        $1::uuid,
        'q-concurrency-1',
        'Pergunta de teste de concorrência?',
        'OBJECTIVE',
        false,
        1,
        'A',
        '[{"label":"A","text":"Op 1","order_index":1},{"label":"B","text":"Op 2","order_index":2}]'::jsonb,
        'Explicação',
        'Topico',
        'SubTopico',
        'doc-1',
        'hash123',
        false
      ) AS result;
    `, [batchId]);

    const resJson = upsertRes1.rows[0]?.result;
    console.log('Transação 1: Upsert concluído com status:', resJson?.status);
    if (!resJson || resJson.success !== true || resJson.status !== 'INSERTED') {
      throw new Error(`Transação 1: Upsert falhou inesperadamente: ${JSON.stringify(resJson)}`);
    }

    // 3. Transação 2: Tenta executar rollback_batch_atomic(p_batch_id) em paralelo
    // A função medrevise_staging.rollback_batch_atomic(UUID) recebe exatamente 1 argumento
    // e executa SELECT ... FROM migration_batches WHERE batch_id = p_batch_id FOR UPDATE;
    // Como a Transação 1 segura FOR SHARE, a Transação 2 é bloqueada a nível de linha.
    // Com lock_timeout de 800ms, o PostgreSQL cancela a chamada com erro 55P03.
    console.log('Transação 2: Configurando lock_timeout de 800ms e tentando rollback_batch_atomic (FOR UPDATE)...');
    await client2.query('SET lock_timeout = 800');

    let lockTimeoutOccurred = false;

    try {
      // rollback_batch_atomic recebe exatamente 1 argumento: p_batch_id UUID
      await client2.query(`
        SELECT medrevise_staging.rollback_batch_atomic($1::uuid) AS result;
      `, [batchId]);
    } catch (err: any) {
      // Validação estrita: não aceitar qualquer erro como sucesso
      const is55P03 = err.code === '55P03';
      const isLockTimeoutMsg = typeof err.message === 'string' && (
        err.message.toLowerCase().includes('lock timeout') || 
        err.message.toLowerCase().includes('canceling statement due to lock timeout')
      );

      if (is55P03 || isLockTimeoutMsg) {
        lockTimeoutOccurred = true;
        console.log(`Transação 2: Chamada cancelada pelo PostgreSQL devido a lock_timeout conforme esperado (código: ${err.code || '55P03'}).`);
      } else {
        // Erro inesperado (sintaxe, tipo, permissão, etc.) -> reprova imediatamente o teste
        throw new Error(`Transação 2 falhou com erro imprevisto (não foi lock timeout): [${err.code}] ${err.message}`);
      }
    }

    if (!lockTimeoutOccurred) {
      throw new Error('Falha no teste de concorrência: a chamada de rollback na Transação 2 não foi bloqueada enquanto a Transação 1 segurava o lote com FOR SHARE.');
    }

    // 4. Conclui Transação 1 e valida que o upsert inseriu a questão
    console.log('Transação 1: Efetuando COMMIT da inserção...');
    await client1.query('COMMIT');

    // Validação intermediária: questão foi efetivamente gravada
    const checkInserted = await client1.query(`
      SELECT id, content_hash FROM medrevise_staging.questions WHERE id = 'q-concurrency-1';
    `);
    if (checkInserted.rows.length !== 1) {
      throw new Error(`Validação falhou: questão 'q-concurrency-1' deveria estar no banco após o commit, mas foram encontradas ${checkInserted.rows.length} linhas.`);
    }
    console.log('✓ Confirmação: questão q-concurrency-1 foi efetivamente inserida pelo upsert.');

    // 5. Atualiza o lote para COMPLETED para habilitar a execução legítima do rollback
    await client1.query(`
      UPDATE medrevise_staging.migration_batches
      SET status = 'COMPLETED', finished_at = clock_timestamp()
      WHERE batch_id = $1;
    `, [batchId]);
    console.log('Lote atualizado para COMPLETED. Liberado para rollback posterior.');

    // 6. Transação 2: Executa uma nova chamada de rollback após a conclusão da Transação 1
    console.log('Transação 2: Efetuando nova chamada de rollback_batch_atomic agora que o lote está concluído...');
    await client2.query('SET lock_timeout = 5000'); // Restaura timeout seguro

    const rollbackRes = await client2.query(`
      SELECT medrevise_staging.rollback_batch_atomic($1::uuid) AS result;
    `, [batchId]);

    const rollbackData = rollbackRes.rows[0]?.result;
    console.log('Transação 2: Resultado do rollback:', rollbackData);

    if (!rollbackData || rollbackData.success !== true || rollbackData.status !== 'ROLLED_BACK') {
      throw new Error(`Falha no rollback posterior: retorno inesperado: ${JSON.stringify(rollbackData)}`);
    }

    // 7. Validação rigorosa do estado final no banco de dados
    // 7.1. Valida que a questão foi removida pelo rollback
    const checkQuestionsRemaining = await client2.query(`
      SELECT count(*) as count FROM medrevise_staging.questions WHERE id = 'q-concurrency-1';
    `);
    const qCount = parseInt(checkQuestionsRemaining.rows[0].count, 10);
    if (qCount !== 0) {
      throw new Error(`Falha: questão 'q-concurrency-1' ainda existe após o rollback (count = ${qCount}, esperado 0).`);
    }
    console.log('✓ Confirmação: questão removida com sucesso pelo rollback (restantes no banco: 0).');

    // 7.2. Valida que o lote termina em ROLLED_BACK
    const checkBatchStatus = await client2.query(`
      SELECT status FROM medrevise_staging.migration_batches WHERE batch_id = $1;
    `, [batchId]);
    const finalBatchStatus = checkBatchStatus.rows[0]?.status;
    if (finalBatchStatus !== 'ROLLED_BACK') {
      throw new Error(`Falha: status do lote deveria ser 'ROLLED_BACK', mas é '${finalBatchStatus}'.`);
    }
    console.log(`✓ Confirmação: status do lote no banco é '${finalBatchStatus}'.`);

    // 7.3. Valida log de auditoria
    const checkAudit = await client2.query(`
      SELECT action, details FROM medrevise_staging.migration_audit_log
      WHERE batch_id = $1 AND action = 'ROLLED_BACK';
    `, [batchId]);
    if (checkAudit.rows.length === 0) {
      throw new Error('Falha: registro de auditoria ROLLED_BACK não foi encontrado.');
    }

    console.log('✓ TESTE DE CONCORRÊNCIA, CANCELAMENTO POR LOCK_TIMEOUT E ROLLBACK REAL APROVADO COM SUCESSO!');

  } finally {
    await client1.end().catch(() => {});
    await client2.end().catch(() => {});
  }
}

// Execução direta se invocado via CLI
if (process.argv[1]?.includes('test_concurrency_real')) {
  runRealConcurrencyTest().catch((err) => {
    console.error('Erro fatal no teste de concorrência real:', err);
    process.exit(1);
  });
}
