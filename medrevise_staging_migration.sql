-- ==============================================================================
-- MEDREVISE — SCRIPT DDL E PROCEDURAL DE MIGRAÇÃO CONTROLADA (ETAPA 4.15 CORRIGIDA)
-- Arquivo: medrevise_staging_migration.sql
-- 
-- OBJETIVO:
--   Criar e configurar o schema isolado `medrevise_staging`, tabelas de destino,
--   tabelas de auditoria/proveniência, e a função atômica e idempotente
--   `upsert_question_atomic`.
--
-- REQUISITOS DE EXPOSIÇÃO NA API SUPABASE:
--   Por padrão, o PostgREST (camada de API REST do Supabase) só expõe o schema `public`.
--   Para invocar RPCs ou consultar tabelas pertencentes a schemas adicionais como `medrevise_staging`,
--   o schema deve ser explicitamente adicionado em:
--     Supabase Dashboard -> Project Settings -> API -> "Extra search path" (ou "Exposed schemas").
--     Adicionar: `medrevise_staging`.
--   Sem essa configuração, chamadas HTTP ao PostgREST para funções fora do search_path
--   retornarão erro 404 (PGRST202: Could not find the function in the schema cache).
--
-- PRIVILÉGIOS MÍNIMOS (LEAST PRIVILEGE):
--   - O acesso a PUBLIC, anon e authenticated permanece revogado.
--   - Acesso restrito a um papel administrativo executor (ex.: `service_role` ou role de migração).
-- ==============================================================================

-- 1. Criação do Schema Isolado
CREATE SCHEMA IF NOT EXISTS medrevise_staging;

-- 2. Tabela de Lotes de Migração (Rastreabilidade e Controle de Estado)
CREATE TABLE IF NOT EXISTS medrevise_staging.migration_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    is_dry_run BOOLEAN NOT NULL DEFAULT false,
    total_processed INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    identical_count INTEGER NOT NULL DEFAULT 0,
    conflict_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB
);

-- Atualização determinística, transacional e idempotente da constraint de status
DO $$
DECLARE
    v_con RECORD;
    v_invalid_count INTEGER;
    v_null_count INTEGER;
BEGIN
    -- 1. Verifica se a tabela existe
    IF EXISTS (
        SELECT 1 
        FROM pg_catalog.pg_class rel
        JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'medrevise_staging'
          AND rel.relname = 'migration_batches'
    ) THEN
        -- 2. Confirma ausência de valores NULL e assegura que a coluna status é NOT NULL
        SELECT count(*) INTO v_null_count
        FROM medrevise_staging.migration_batches
        WHERE status IS NULL;

        IF v_null_count > 0 THEN
            RAISE EXCEPTION 'Não é possível atualizar constraint de status: existem % registro(s) com status NULL em medrevise_staging.migration_batches.', v_null_count;
        END IF;

        ALTER TABLE medrevise_staging.migration_batches 
            ALTER COLUMN status SET NOT NULL;

        -- 3. Valida os valores existentes contra o domínio canônico permitido
        SELECT count(*) INTO v_invalid_count
        FROM medrevise_staging.migration_batches
        WHERE status NOT IN ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'ROLLED_BACK');

        IF v_invalid_count > 0 THEN
            RAISE EXCEPTION 'Não é possível atualizar a constraint de status: existem % registro(s) com valores incompatíveis em medrevise_staging.migration_batches.', v_invalid_count;
        END IF;

        -- 4. Remove deterministicamente apenas CHECK constraints que envolvam exclusivamente
        --    a coluna status (cardinality = 1), preservando intactas constraints compostas
        --    e quaisquer regras de integridade multi-colunas.
        FOR v_con IN (
            SELECT con.conname
            FROM pg_catalog.pg_constraint con
            JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
            JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
            JOIN pg_catalog.pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
            WHERE nsp.nspname = 'medrevise_staging'
              AND rel.relname = 'migration_batches'
              AND con.contype = 'c'
              AND array_length(con.conkey, 1) = 1
              AND (att.attname = 'status' OR con.conname = 'migration_batches_status_check')
        ) LOOP
            EXECUTE format('ALTER TABLE medrevise_staging.migration_batches DROP CONSTRAINT %I', v_con.conname);
        END LOOP;

        -- 5. Cria a constraint CHECK canônica com exatamente os cinco estados válidos
        ALTER TABLE medrevise_staging.migration_batches
            ADD CONSTRAINT migration_batches_status_check 
            CHECK (status IN ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'ROLLED_BACK'));
    END IF;
END $$;

-- 3. Tabela de Questões Staging
CREATE TABLE IF NOT EXISTS medrevise_staging.questions (
    id TEXT PRIMARY KEY,
    statement TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('OBJECTIVE', 'DISCURSIVE')),
    is_discursive BOOLEAN NOT NULL DEFAULT false,
    correct_option_index INTEGER,
    correct_answer TEXT,
    alternatives JSONB,
    explanation TEXT,
    topic TEXT,
    sub_subject TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    source_document_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    CONSTRAINT chk_discursive_consistency CHECK (
        (question_type = 'DISCURSIVE' AND is_discursive = true AND correct_option_index IS NULL) OR
        (question_type = 'OBJECTIVE' AND is_discursive = false AND correct_option_index IS NOT NULL)
    )
);

-- 4. Tabela de Proveniência e Auditoria Fina (Vinculação Estrita por Lote)
CREATE TABLE IF NOT EXISTS medrevise_staging.migration_audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES medrevise_staging.migration_batches(batch_id) ON DELETE RESTRICT,
    question_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERTED', 'IDENTICAL_MATCH', 'CONTENT_CONFLICT', 'REJECTED_REVIEW', 'ERROR', 'ROLLED_BACK')),
    was_inserted_by_this_batch BOOLEAN NOT NULL DEFAULT false,
    content_hash TEXT,
    details JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_audit_batch_question 
ON medrevise_staging.migration_audit_log (batch_id, question_id);

CREATE INDEX IF NOT EXISTS idx_staging_questions_hash 
ON medrevise_staging.questions (content_hash);

-- 5. Função Transacional e Atômica: medrevise_staging.upsert_question_atomic
--    Retorna JSONB estruturado sem estourar exceções não tratadas para conflitos conhecidos.
CREATE OR REPLACE FUNCTION medrevise_staging.upsert_question_atomic(
    p_batch_id UUID,
    p_question_id TEXT,
    p_statement TEXT,
    p_question_type TEXT,
    p_is_discursive BOOLEAN,
    p_correct_option_index INTEGER,
    p_correct_answer TEXT,
    p_alternatives JSONB,
    p_explanation TEXT,
    p_topic TEXT,
    p_sub_subject TEXT,
    p_source_document_id TEXT,
    p_content_hash TEXT,
    p_dry_run BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_existing_hash TEXT;
    v_existing_source TEXT;
    v_alt_count INTEGER;
    v_elem JSONB;
    v_label TEXT;
    v_text TEXT;
    v_order_raw JSONB;
    v_order_num NUMERIC;
    v_order_int INTEGER;
    v_expected_order INTEGER := 1;
    v_labels_seen TEXT[] := '{}';
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_batch_status TEXT;
BEGIN
    -- 5.1. Validação do Lote de Migração (Trava de Concorrência e Estado)
    -- Trava com FOR SHARE: compatível entre múltiplos upserts simultâneos, mas bloqueia
    -- mutuamente qualquer transação de rollback executando FOR UPDATE no mesmo lote.
    SELECT status INTO v_batch_status 
    FROM medrevise_staging.migration_batches 
    WHERE batch_id = p_batch_id
    FOR SHARE;

    IF v_batch_status IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'ERROR',
            'code', 'BATCH_NOT_FOUND',
            'message', 'Lote de migração especificado não existe.'
        );
    END IF;

    IF v_batch_status != 'RUNNING' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'ERROR',
            'code', 'BATCH_INVALID_STATE',
            'message', format('Lote está no estado %s; operações rejeitadas.', v_batch_status)
        );
    END IF;

    -- 5.2. Validações de Identificadores e Strings Mandatórias
    IF p_question_id IS NULL OR btrim(p_question_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'status', 'ERROR', 'code', 'INVALID_QUESTION_ID', 'message', 'ID da questão nulo ou vazio');
    END IF;

    IF p_statement IS NULL OR btrim(p_statement) = '' THEN
        RETURN jsonb_build_object('success', false, 'status', 'ERROR', 'code', 'INVALID_STATEMENT', 'message', 'Enunciado da questão nulo ou vazio');
    END IF;

    IF p_source_document_id IS NULL OR btrim(p_source_document_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'status', 'ERROR', 'code', 'INVALID_SOURCE_DOC_ID', 'message', 'ID do documento de origem nulo ou vazio');
    END IF;

    IF p_content_hash IS NULL OR btrim(p_content_hash) = '' THEN
        RETURN jsonb_build_object('success', false, 'status', 'ERROR', 'code', 'INVALID_CONTENT_HASH', 'message', 'Hash de conteúdo nulo ou vazio');
    END IF;

    -- 5.3. Validação Estrita do Tipo de Questão
    IF p_question_type NOT IN ('OBJECTIVE', 'DISCURSIVE') THEN
        RETURN jsonb_build_object(
            'success', false, 
            'status', 'ERROR', 
            'code', 'INVALID_QUESTION_TYPE', 
            'message', 'question_type deve ser estritamente OBJECTIVE ou DISCURSIVE'
        );
    END IF;

    -- 5.4. Validação Específica para Questões Discursivas
    IF p_question_type = 'DISCURSIVE' THEN
        IF p_is_discursive IS DISTINCT FROM true THEN
            RETURN jsonb_build_object(
                'success', false, 
                'status', 'ERROR', 
                'code', 'DISCURSIVE_FLAG_MISMATCH', 
                'message', 'Questão DISCURSIVE exige is_discursive = true'
            );
        END IF;

        IF p_correct_option_index IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false, 
                'status', 'ERROR', 
                'code', 'DISCURSIVE_HAS_OPTION_INDEX', 
                'message', 'Questão DISCURSIVE não pode ter correct_option_index'
            );
        END IF;

        IF p_alternatives IS NOT NULL THEN
            IF jsonb_typeof(p_alternatives) <> 'array' THEN
                RETURN jsonb_build_object(
                    'success', false, 
                    'status', 'ERROR', 
                    'code', 'INVALID_ALTERNATIVES_TYPE', 
                    'message', 'alternatives para questão discursiva deve ser NULL ou array JSON vazio'
                );
            END IF;
            IF jsonb_array_length(p_alternatives) > 0 THEN
                RETURN jsonb_build_object(
                    'success', false, 
                    'status', 'ERROR', 
                    'code', 'DISCURSIVE_NON_EMPTY_ALTERNATIVES', 
                    'message', 'Questão DISCURSIVE não permite alternativas preenchidas'
                );
            END IF;
        END IF;

    -- 5.5. Validação Específica para Questões Objetivas
    ELSE -- p_question_type = 'OBJECTIVE'
        IF p_is_discursive IS DISTINCT FROM false THEN
            RETURN jsonb_build_object(
                'success', false, 
                'status', 'ERROR', 
                'code', 'OBJECTIVE_FLAG_MISMATCH', 
                'message', 'Questão OBJECTIVE exige is_discursive = false'
            );
        END IF;

        IF p_alternatives IS NULL OR jsonb_typeof(p_alternatives) <> 'array' THEN
            RETURN jsonb_build_object(
                'success', false, 
                'status', 'ERROR', 
                'code', 'MISSING_ALTERNATIVES_ARRAY', 
                'message', 'Questão OBJECTIVE exige alternatives como array JSON válido'
            );
        END IF;

        v_alt_count := jsonb_array_length(p_alternatives);
        IF v_alt_count < 2 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'status', 'ERROR', 
                'code', 'TOO_FEW_ALTERNATIVES', 
                'message', 'Questão OBJECTIVE exige no mínimo 2 alternativas'
            );
        END IF;

        IF p_correct_option_index IS NULL OR p_correct_option_index < 0 OR p_correct_option_index >= v_alt_count THEN
            RETURN jsonb_build_object(
                'success', false, 
                'status', 'ERROR', 
                'code', 'INVALID_CORRECT_OPTION_INDEX', 
                'message', format('correct_option_index (%s) fora do intervalo permitido [0, %s]', p_correct_option_index, v_alt_count - 1)
            );
        END IF;

        -- Validação individual e sequencial de cada alternativa
        FOR v_elem IN SELECT * FROM jsonb_array_elements(p_alternatives)
        LOOP
            IF jsonb_typeof(v_elem) <> 'object' THEN
                RETURN jsonb_build_object(
                    'success', false, 
                    'status', 'ERROR', 
                    'code', 'ALTERNATIVE_NOT_OBJECT', 
                    'message', 'Cada elemento de alternatives deve ser um objeto JSON'
                );
            END IF;

            v_label := v_elem->>'label';
            v_text := v_elem->>'text';
            v_order_raw := v_elem->'order_index';

            IF v_label IS NULL OR btrim(v_label) = '' THEN
                RETURN jsonb_build_object('success', false, 'status', 'ERROR', 'code', 'EMPTY_ALTERNATIVE_LABEL', 'message', 'Label da alternativa não pode ser vazio');
            END IF;

            IF v_text IS NULL OR btrim(v_text) = '' THEN
                RETURN jsonb_build_object('success', false, 'status', 'ERROR', 'code', 'EMPTY_ALTERNATIVE_TEXT', 'message', 'Texto da alternativa não pode ser vazio');
            END IF;

            IF v_order_raw IS NULL OR jsonb_typeof(v_order_raw) <> 'number' THEN
                RETURN jsonb_build_object('success', false, 'status', 'ERROR', 'code', 'INVALID_ORDER_INDEX_TYPE', 'message', 'order_index deve ser número JSON');
            END IF;

            v_order_num := (v_order_raw::text)::numeric;
            IF v_order_num <> trunc(v_order_num) THEN
                RETURN jsonb_build_object('success', false, 'status', 'ERROR', 'code', 'NON_INTEGER_ORDER_INDEX', 'message', 'order_index deve ser inteiro exato');
            END IF;

            v_order_int := v_order_num::integer;

            -- Exige ordem 1-based sequencial sem saltos nem duplicidades
            IF v_order_int <> v_expected_order THEN
                RETURN jsonb_build_object(
                    'success', false, 
                    'status', 'ERROR', 
                    'code', 'NON_SEQUENTIAL_ORDER_INDEX', 
                    'message', format('order_index esperado era %s, recebido %s', v_expected_order, v_order_int)
                );
            END IF;

            -- Exige rótulos únicos
            IF v_label = ANY(v_labels_seen) THEN
                RETURN jsonb_build_object(
                    'success', false, 
                    'status', 'ERROR', 
                    'code', 'DUPLICATE_ALTERNATIVE_LABEL', 
                    'message', format('Rótulo de alternativa duplicado: %s', v_label)
                );
            END IF;

            v_labels_seen := array_append(v_labels_seen, v_label);
            v_expected_order := v_expected_order + 1;
        END LOOP;
    END IF;

    -- 5.6. Verificação de Registro Existente no Destino
    SELECT content_hash, source_document_id 
    INTO v_existing_hash, v_existing_source
    FROM medrevise_staging.questions
    WHERE id = p_question_id;

    IF FOUND THEN
        -- Se já existe e o hash é estritamente idêntico: Idempotente
        IF v_existing_hash = p_content_hash THEN
            IF NOT p_dry_run THEN
                INSERT INTO medrevise_staging.migration_audit_log (
                    batch_id, question_id, action, was_inserted_by_this_batch, content_hash, details, occurred_at
                ) VALUES (
                    p_batch_id, p_question_id, 'IDENTICAL_MATCH', false, p_content_hash,
                    jsonb_build_object('message', 'Registro já existente possui conteúdo rigorosamente idêntico.'),
                    v_now
                );
            END IF;

            RETURN jsonb_build_object(
                'success', true,
                'status', 'IDENTICAL_MATCH',
                'question_id', p_question_id,
                'content_hash', p_content_hash,
                'message', 'Registro já existente é idêntico; idempotência confirmada sem reescrita.'
            );
        ELSE
            -- Se já existe e o hash diverge: Conflito de Conteúdo (Não sobrescreve)
            IF NOT p_dry_run THEN
                INSERT INTO medrevise_staging.migration_audit_log (
                    batch_id, question_id, action, was_inserted_by_this_batch, content_hash, details, occurred_at
                ) VALUES (
                    p_batch_id, p_question_id, 'CONTENT_CONFLICT', false, p_content_hash,
                    jsonb_build_object(
                        'message', 'ID já existente no destino com hash divergente.',
                        'existing_hash', v_existing_hash,
                        'incoming_hash', p_content_hash
                    ),
                    v_now
                );
            END IF;

            RETURN jsonb_build_object(
                'success', false,
                'status', 'CONTENT_CONFLICT',
                'question_id', p_question_id,
                'existing_hash', v_existing_hash,
                'incoming_hash', p_content_hash,
                'message', 'ID já existente com conteúdo divergente. Sobrescrita recusada por segurança.'
            );
        END IF;
    END IF;

    -- 5.7. Inserção (quando não for Dry Run)
    IF p_dry_run THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'INSERT_SIMULATED',
            'question_id', p_question_id,
            'content_hash', p_content_hash,
            'message', 'Simulação dry-run bem sucedida; registro apto para inserção.'
        );
    END IF;

    INSERT INTO medrevise_staging.questions (
        id, statement, question_type, is_discursive, correct_option_index,
        correct_answer, alternatives, explanation, topic, sub_subject,
        created_at, updated_at, source_document_id, content_hash
    ) VALUES (
        p_question_id, p_statement, p_question_type, p_is_discursive, p_correct_option_index,
        p_correct_answer, p_alternatives, p_explanation, p_topic, p_sub_subject,
        v_now, v_now, p_source_document_id, p_content_hash
    );

    -- Auditoria com flag estrita de inserção por este lote
    INSERT INTO medrevise_staging.migration_audit_log (
        batch_id, question_id, action, was_inserted_by_this_batch, content_hash, details, occurred_at
    ) VALUES (
        p_batch_id, p_question_id, 'INSERTED', true, p_content_hash,
        jsonb_build_object('message', 'Questão inserida com sucesso no schema de staging.'),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', 'INSERTED',
        'question_id', p_question_id,
        'content_hash', p_content_hash,
        'message', 'Questão inserida com sucesso.'
    );

EXCEPTION
    WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_text = CONSTRAINT_NAME;
        RETURN jsonb_build_object(
            'success', false,
            'status', 'ERROR',
            'code', 'CONCURRENT_UNIQUE_VIOLATION',
            'constraint', v_text,
            'message', 'Concorrência detectada: violação de unicidade durante inserção.'
        );
    WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_text = MESSAGE_TEXT;
        RETURN jsonb_build_object(
            'success', false,
            'status', 'ERROR',
            'code', 'UNEXPECTED_SQL_ERROR',
            'message', v_text
        );
END;
$$;

-- 6. Função de Rollback Seguro do Lote (Remove Apenas o que Foi Efetivamente Inserido Pelo Lote e Confere Hash)
CREATE OR REPLACE FUNCTION medrevise_staging.rollback_batch_atomic(
    p_batch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_batch_status TEXT;
    v_deleted_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_rec RECORD;
    v_current_hash TEXT;
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
    -- 6.1. Trava explícita da linha do lote para serializar operações e evitar concorrência
    SELECT status INTO v_batch_status
    FROM medrevise_staging.migration_batches
    WHERE batch_id = p_batch_id
    FOR UPDATE;

    IF v_batch_status IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'BATCH_NOT_FOUND',
            'message', 'Lote não encontrado.'
        );
    END IF;

    -- 6.2. Impedir rollback de lote ainda em execução (RUNNING)
    IF v_batch_status = 'RUNNING' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'BATCH_STILL_RUNNING',
            'message', 'Rollback recusado: lote ainda está em andamento (RUNNING). Aguarde a conclusão ou falha antes de reverter.'
        );
    END IF;

    -- 6.3. Idempotência do rollback: impedir dupla reversão
    IF v_batch_status = 'ROLLED_BACK' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ALREADY_ROLLED_BACK',
            'message', 'Lote já revertido anteriormente.'
        );
    END IF;

    -- 6.4. Permitir rollback apenas para estados terminais compatíveis
    IF v_batch_status NOT IN ('COMPLETED', 'PARTIAL', 'FAILED') THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'INVALID_BATCH_STATUS_FOR_ROLLBACK',
            'message', format('Status %s incompatível para rollback.', v_batch_status)
        );
    END IF;

    -- 6.5. Localiza e remove EXCLUSIVAMENTE as questões inseridas por este lote,
    --      validando que o hash atual ainda confere com o hash original registrado na inserção.
    FOR v_rec IN 
        SELECT question_id, content_hash
        FROM medrevise_staging.migration_audit_log
        WHERE batch_id = p_batch_id 
          AND action = 'INSERTED' 
          AND was_inserted_by_this_batch = true
    LOOP
        -- Consulta o hash atual na tabela de staging
        SELECT content_hash INTO v_current_hash
        FROM medrevise_staging.questions
        WHERE id = v_rec.question_id;

        IF FOUND THEN
            -- Se o hash confere exatamente com o auditado pelo lote, exclui com segurança
            IF v_current_hash = v_rec.content_hash THEN
                DELETE FROM medrevise_staging.questions 
                WHERE id = v_rec.question_id;

                v_deleted_count := v_deleted_count + 1;
            ELSE
                -- Registro foi alterado posteriormente por outra rotina: NÃO deleta silenciosamente
                v_skipped_count := v_skipped_count + 1;
                INSERT INTO medrevise_staging.migration_audit_log (
                    batch_id, question_id, action, was_inserted_by_this_batch, content_hash, details, occurred_at
                ) VALUES (
                    p_batch_id, v_rec.question_id, 'REJECTED_REVIEW', false, v_current_hash,
                    jsonb_build_object(
                        'reason', 'Rollback ignorou exclusão: hash da questão difere do hash originalmente inserido pelo lote.',
                        'expected_hash', v_rec.content_hash,
                        'current_hash', v_current_hash
                    ),
                    v_now
                );
            END IF;
        END IF;
    END LOOP;

    -- 6.6. Registra o resumo do rollback na auditoria
    INSERT INTO medrevise_staging.migration_audit_log (
        batch_id, question_id, action, was_inserted_by_this_batch, details, occurred_at
    ) VALUES (
        p_batch_id, 'BATCH_SUMMARY', 'ROLLED_BACK', false,
        jsonb_build_object('deleted_count', v_deleted_count, 'skipped_due_to_hash_mismatch', v_skipped_count),
        v_now
    );

    -- 6.7. Atualiza status do lote de forma atômica
    UPDATE medrevise_staging.migration_batches
    SET status = 'ROLLED_BACK', finished_at = v_now
    WHERE batch_id = p_batch_id;

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', p_batch_id,
        'status', 'ROLLED_BACK',
        'deleted_count', v_deleted_count,
        'skipped_count', v_skipped_count,
        'message', format('Rollback executado com sucesso. %s questões removidas com segurança (%s ignoradas por alteração posterior).', v_deleted_count, v_skipped_count)
    );
END;
$$;

-- 7. POLÍTICA DE PRIVILÉGIOS MÍNIMOS (LEAST PRIVILEGE)
-- Revogar completamente acesso de roles públicas ou desnecessárias
REVOKE ALL ON SCHEMA medrevise_staging FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA medrevise_staging FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA medrevise_staging FROM PUBLIC, anon, authenticated;

-- Conceder permissões apenas à role administradora executora (service_role no Supabase)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE ON SCHEMA medrevise_staging TO service_role;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA medrevise_staging TO service_role;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA medrevise_staging TO service_role;
        GRANT EXECUTE ON FUNCTION medrevise_staging.upsert_question_atomic(UUID, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
        GRANT EXECUTE ON FUNCTION medrevise_staging.rollback_batch_atomic(UUID) TO service_role;
    END IF;
END $$;
