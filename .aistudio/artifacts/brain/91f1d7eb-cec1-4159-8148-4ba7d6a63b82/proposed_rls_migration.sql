-- ==============================================================================
-- MEDREVISE — PROPOSTA DE MIGRAÇÃO TRANSACIONAL DE RLS E PRIVILÉGIOS
-- TABELA: public.firestore_documents
-- STATUS: SOMENTE LEITURA / PROPOSTA PARA REVISÃO HUMANA (NÃO EXECUTAR)
-- ==============================================================================

BEGIN;

-- 1. CRIAÇÃO DA TABELA DE ADMINISTRADORES PRIVADA (FONTE DE VERDADE SEGURA NO BANCO)
CREATE TABLE IF NOT EXISTS public.app_admins (
    user_id TEXT PRIMARY KEY,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS estrito na tabela de administradores
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_admins FORCE ROW LEVEL SECURITY;

-- Apenas o próprio admin ou service_role pode consultar se é admin
CREATE POLICY "Admins can view their own admin status"
ON public.app_admins
FOR SELECT
TO authenticated
USING (user_id = (auth.jwt()->>'sub'));

-- Sem inserção pública na tabela de admins
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.app_admins FROM anon, authenticated;

-- Inserção inicial idempotente do administrador confirmado
INSERT INTO public.app_admins (user_id, email)
VALUES ('EGnLP2lyHmQ6goHhqJrTEmX4Hni2', 'lucas1renck2melo@gmail.com')
ON CONFLICT (user_id) DO NOTHING;


-- 2. REVISÃO DE PRIVILÉGIOS DA TABELA firestore_documents
-- Revogar imediatamente privilégios perigosos e desnecessários concedidos a anon e authenticated
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.firestore_documents FROM anon, authenticated;


-- 3. REMOÇÃO ATÔMICA DAS POLÍTICAS ABERTAS EXISTENTES
-- (Substituindo 'Allow all access' e políticas abertas sem filtro de UID)
DROP POLICY IF EXISTS "Allow all access" ON public.firestore_documents;
DROP POLICY IF EXISTS "allow_all_access" ON public.firestore_documents;
DROP POLICY IF EXISTS "Allow read access" ON public.firestore_documents;
DROP POLICY IF EXISTS "Allow insert access" ON public.firestore_documents;
DROP POLICY IF EXISTS "Allow update access" ON public.firestore_documents;
DROP POLICY IF EXISTS "Allow delete access" ON public.firestore_documents;


-- 4. HABILITAR E FORÇAR RLS NA TABELA firestore_documents
ALTER TABLE public.firestore_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firestore_documents FORCE ROW LEVEL SECURITY;


-- 5. POLÍTICAS DE CONTEÚDO COMPARTILHADO (LEITURA PÚBLICA)
-- Questões, tópicos curriculares, matérias gerais, semestres gerais e flashcards oficiais
CREATE POLICY "Public read for shared educational content"
ON public.firestore_documents
FOR SELECT
TO anon, authenticated
USING (
    collection IN (
        'questions', 
        'topics', 
        'subjects', 
        'semesters', 
        'flashcards', 
        'medrevise_topics', 
        'imported_exams',
        'global'
    )
);

-- Escrita e Modificação de Conteúdo Compartilhado: EXCLUSIVO DE ADMINISTRADORES
CREATE POLICY "Admin write for shared educational content"
ON public.firestore_documents
FOR ALL
TO authenticated
USING (
    collection IN (
        'questions', 
        'topics', 
        'subjects', 
        'semesters', 
        'flashcards', 
        'medrevise_topics', 
        'imported_exams',
        'global'
    )
    AND EXISTS (
        SELECT 1 FROM public.app_admins WHERE user_id = (auth.jwt()->>'sub')
    )
)
WITH CHECK (
    collection IN (
        'questions', 
        'topics', 
        'subjects', 
        'semesters', 
        'flashcards', 
        'medrevise_topics', 
        'imported_exams',
        'global'
    )
    AND EXISTS (
        SELECT 1 FROM public.app_admins WHERE user_id = (auth.jwt()->>'sub')
    )
);


-- 6. POLÍTICAS DE DADOS PRIVADOS DO USUÁRIO

-- A. Subcoleções aninhadas users/{UID}/... (calendarEvents, studySessions, topics, mockExams, etc.)
CREATE POLICY "Users can manage their own nested subcollections"
ON public.firestore_documents
FOR ALL
TO authenticated
USING (
    collection LIKE 'users/' || (auth.jwt()->>'sub') || '/%'
)
WITH CHECK (
    collection LIKE 'users/' || (auth.jwt()->>'sub') || '/%'
);

-- B. Perfil do próprio usuário (collection = 'users', id = UID)
CREATE POLICY "Users can view and manage their own profile"
ON public.firestore_documents
FOR ALL
TO authenticated
USING (
    collection = 'users' AND id = (auth.jwt()->>'sub')
)
WITH CHECK (
    collection = 'users' AND id = (auth.jwt()->>'sub')
    -- Impede que um usuário comum altere seu próprio campo 'role' para 'admin' no JSONB
    AND (
        (data->>'role') IS DISTINCT FROM 'admin'
        OR EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = (auth.jwt()->>'sub'))
    )
);

-- C. Progresso individual do usuário (collection = 'userProgress', id = UID)
CREATE POLICY "Users can manage their own userProgress"
ON public.firestore_documents
FOR ALL
TO authenticated
USING (
    collection = 'userProgress' AND id = (auth.jwt()->>'sub')
)
WITH CHECK (
    collection = 'userProgress' AND id = (auth.jwt()->>'sub')
);

-- D. Tentativas de simulados (collection = 'quizAttempts', id = UID_sessionId)
CREATE POLICY "Users can manage their own quizAttempts"
ON public.firestore_documents
FOR ALL
TO authenticated
USING (
    collection = 'quizAttempts' AND (
        id LIKE ((auth.jwt()->>'sub') || '\_%') ESCAPE '\'
        OR (data->>'userId') = (auth.jwt()->>'sub')
    )
)
WITH CHECK (
    collection = 'quizAttempts' AND (
        id LIKE ((auth.jwt()->>'sub') || '\_%') ESCAPE '\'
        OR (data->>'userId') = (auth.jwt()->>'sub')
    )
);

-- E. Registros de primeiro nível legados (studySessions, calendarEvents com userId)
CREATE POLICY "Users can manage their own root-level studySessions and calendarEvents"
ON public.firestore_documents
FOR ALL
TO authenticated
USING (
    collection IN ('studySessions', 'calendarEvents', 'flashcardSessions')
    AND (data->>'userId') = (auth.jwt()->>'sub')
)
WITH CHECK (
    collection IN ('studySessions', 'calendarEvents', 'flashcardSessions')
    AND (data->>'userId') = (auth.jwt()->>'sub')
);


-- 7. POLÍTICAS DE AUDITORIA, SISTEMA E ADMINISTRAÇÃO

-- A. Logs de Erro do Sistema: Usuários autenticados podem inserir seus logs; apenas admins podem ler
CREATE POLICY "Authenticated users can report system errors"
ON public.firestore_documents
FOR INSERT
TO authenticated
WITH CHECK (
    collection = 'systemErrors'
);

CREATE POLICY "Admins can view system errors"
ON public.firestore_documents
FOR SELECT
TO authenticated
USING (
    collection = 'systemErrors'
    AND EXISTS (
        SELECT 1 FROM public.app_admins WHERE user_id = (auth.jwt()->>'sub')
    )
);

-- B. E-mails pré-autorizados (pre_authorized_emails): Acesso exclusivo de Administradores
CREATE POLICY "Admins manage pre_authorized_emails"
ON public.firestore_documents
FOR ALL
TO authenticated
USING (
    collection = 'pre_authorized_emails'
    AND EXISTS (
        SELECT 1 FROM public.app_admins WHERE user_id = (auth.jwt()->>'sub')
    )
)
WITH CHECK (
    collection = 'pre_authorized_emails'
    AND EXISTS (
        SELECT 1 FROM public.app_admins WHERE user_id = (auth.jwt()->>'sub')
    )
);

-- C. Referral Logs: Leitura permitida para quem indicou, quem foi indicado, ou admin
CREATE POLICY "Users can view their own referral logs"
ON public.firestore_documents
FOR SELECT
TO authenticated
USING (
    collection = 'referralLogs' AND (
        (data->>'referrerId') = (auth.jwt()->>'sub')
        OR (data->>'referredId') = (auth.jwt()->>'sub')
        OR EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = (auth.jwt()->>'sub'))
    )
);

CREATE POLICY "Users can insert referral logs"
ON public.firestore_documents
FOR INSERT
TO authenticated
WITH CHECK (
    collection = 'referralLogs' AND (
        (data->>'referrerId') = (auth.jwt()->>'sub')
        OR (data->>'referredId') = (auth.jwt()->>'sub')
    )
);

COMMIT;
