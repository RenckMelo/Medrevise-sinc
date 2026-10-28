-- ============================================================================
-- PROPOSTA REVISADA DE POLÍTICA RLS PARA A TABELA firestore_documents
-- ARQUIVO: supabase_security_policy.sql
-- NOTA: ESTE ARQUIVO É UMA PROPOSTA E NÃO FOI EXECUTADO NO BANCO DE PRODUÇÃO.
-- ============================================================================

-- 1. Habilitar Row Level Security na tabela firestore_documents
ALTER TABLE public.firestore_documents ENABLE ROW LEVEL SECURITY;

-- 2. DDL Procedural Dinâmico para remover TODAS as políticas pré-existentes na tabela
--    Garante a eliminação de qualquer regra permissiva residual (evita combinações por OR)
DO $$
DECLARE
    v_pol RECORD;
BEGIN
    FOR v_pol IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'firestore_documents'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.firestore_documents', v_pol.policyname);
    END LOOP;
END $$;

-- 3. Configurar privilégios de tabela (Princípio do Menor Privilégio)
-- Revoga todos os privilégios diretos dos papéis anon e authenticated
REVOKE ALL ON TABLE public.firestore_documents FROM anon, authenticated;

-- Concede exclusivamente permissão de leitura (SELECT) aos papéis públicos
GRANT SELECT ON TABLE public.firestore_documents TO anon, authenticated;

-- Concede privilégios administrativos totais exclusivamente para a role service_role (usada pelo backend)
GRANT ALL ON TABLE public.firestore_documents TO service_role;

-- 4. Criar Política RLS Restritiva (Padrão: Negar Tudo, Permitir Apenas Leitura de Conteúdo Estático)
CREATE POLICY "Allow public SELECT exclusively on static educational content"
ON public.firestore_documents
FOR SELECT
TO anon, authenticated
USING (
  collection IN (
    'questions',
    'topics',
    'subjects',
    'semesters',
    'sourceDocuments',
    'source_documents',
    'examSets',
    'simulados',
    'imported_exams'
  )
);

-- NOTA TÉCNICA DE ARQUITETURA:
-- Como a aplicação utiliza Firebase Auth no front-end, a identidade do usuário (UID)
-- não é nativamente injetada em auth.uid() pelo Supabase GoTrue no cabeçalho JWT da role 'anon'.
-- Portanto, TODAS as coleções privadas (userProgress, users, quizAttempts, flashcardSessions,
-- userSuggestions, systemErrors, errorLogs, aiUsage, pre_authorized_emails, referralLogs)
-- continuam inacessíveis para o papel 'anon' direto do Supabase e são manipuladas com
-- segurança exclusivamente pelo backend Express via Netlify Serverless Functions (role service_role).
