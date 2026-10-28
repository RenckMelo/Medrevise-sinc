// Set mock environment variables for Node test runner before importing
delete process.env.VITE_APP_ENV;
delete process.env.APP_ENV;
process.env.VITE_FIREBASE_API_KEY = 'mock-api-key';
process.env.VITE_FIREBASE_PROJECT_ID = 'gen-lang-client-0128984368';
process.env.VITE_FIREBASE_AUTH_DOMAIN = 'gen-lang-client-0128984368.firebaseapp.com';
process.env.VITE_FIREBASE_APP_ID = '1:12345:web:test';
process.env.VITE_FIREBASE_DATABASE_ID = 'ai-studio-91f1d7eb-cec1-4159-8148-4ba7d6a63b82';

const { 
  isSelfHealingDryRun, 
  calculateTopicRepair, 
  executeTopicAutoSync 
} = await import('../src/hooks/useStudyData');

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[Assertion Error] ${msg}`);
  }
}

console.log('=== INICIANDO TESTES DO SELF-HEALING NO PREVIEW ===');

// 1. Testes de detecção de ambiente (isSelfHealingDryRun)
{
  // No Preview/Dev: PROD é falso e VITE_APP_ENV está vazio
  const previewEnv1 = { PROD: false, VITE_APP_ENV: '' };
  assert(isSelfHealingDryRun(previewEnv1) === true, 'Preview (PROD: false, vazio) deve ativar dry-run');

  // Caso VITE_APP_ENV seja indefinido
  const previewEnv2 = { PROD: false };
  assert(isSelfHealingDryRun(previewEnv2) === true, 'Preview sem VITE_APP_ENV deve ativar dry-run');

  // Caso acidental: PROD verdadeiro, mas sem VITE_APP_ENV="production"
  const partialEnv = { PROD: true, VITE_APP_ENV: undefined };
  assert(isSelfHealingDryRun(partialEnv) === true, 'PROD sem VITE_APP_ENV=production deve manter dry-run seguro');

  // Somente em produção real (Netlify build com PROD=true e VITE_APP_ENV=production)
  const prodEnv = { PROD: true, VITE_APP_ENV: 'production' };
  assert(isSelfHealingDryRun(prodEnv) === false, 'Produção legítima deve desativar dry-run e permitir gravações');

  console.log('✓ 1. Detecção de ambiente (isSelfHealingDryRun) validada com sucesso.');
}

// 2. Testes de cálculo de reparo (calculateTopicRepair)
{
  const mockSessions = [
    { id: 's-1', topicId: 'top-1', date: '2026-03-01T10:00:00Z' },
    { id: 's-2', topicId: 'top-1', date: '2026-03-10T15:00:00Z' },
  ];

  // Caso A: Tópico já consistente (não precisa de reparo)
  const consistentTopic = {
    id: 'top-1',
    name: 'Cardiologia - HAS',
    repetitions: 2,
    lastReviewDate: '2026-03-10T15:00:00Z',
    nextReviewDate: '2026-03-15T15:00:00Z',
    interval: 5,
  };
  const calc1 = calculateTopicRepair(consistentTopic, mockSessions);
  assert(calc1 === null, 'Tópico consistente não deve gerar reparo');

  // Caso B: Tópico desincronizado (repetitions: 0)
  const outOfSyncTopic = {
    id: 'top-1',
    name: 'Cardiologia - HAS',
    repetitions: 0,
    lastReviewDate: undefined,
    nextReviewDate: undefined,
    interval: 3,
  };
  const calc2 = calculateTopicRepair(outOfSyncTopic, mockSessions);
  assert(calc2 !== null, 'Tópico com 0 repetições deve gerar reparo');
  assert(calc2!.needsRepair === true, 'needsRepair deve ser true');
  assert(calc2!.repsCount === 2, 'repsCount deve ser 2');
  assert(calc2!.latestDate === '2026-03-10T15:00:00Z', 'latestDate deve ser a data da sessão mais recente');
  assert(calc2!.updatePayload.repetitions === 2, 'updatePayload.repetitions deve ser 2');
  assert(calc2!.updatePayload.lastReviewDate === '2026-03-10T15:00:00Z', 'updatePayload.lastReviewDate deve coincidir com a data recente');
  assert(typeof calc2!.updatePayload.nextReviewDate === 'string', 'nextReviewDate deve ter sido calculada');

  // Caso C: Sem sessões associadas
  const emptySessionsTopic = {
    id: 'top-2',
    name: 'Neurologia',
    repetitions: 0,
    interval: 1,
  };
  const calc3 = calculateTopicRepair(emptySessionsTopic, []);
  assert(calc3 === null, 'Tópico sem sessões não deve gerar reparo');

  console.log('✓ 2. Cálculo de discrepância e cálculo de payload validados com sucesso.');
}

// 3. Teste de execução no modo Dry-Run (Preview) vs Modo Produção
{
  async function runExecutionTests() {
    const topics = [
      {
        id: 'top-1',
        name: 'Infectologia - Sífilis',
        repetitions: 0,
        lastReviewDate: undefined,
        interval: 1,
      } as any,
    ];

    const sessions = [
      {
        id: 'sess-100',
        topicId: 'top-1',
        date: '2026-04-01T12:00:00Z',
        durationSeconds: 1500,
        studyTimeMinutes: 25,
        questionsCount: 10,
        correctCount: 9,
      } as any,
    ];

    let updateDocCallCount = 0;
    const mockUpdateDoc = async () => {
      updateDocCallCount++;
    };

    const loggedMessages: string[] = [];
    const mockLog = (msg: string) => {
      loggedMessages.push(msg);
    };

    // Cenário A: DRY RUN (Preview)
    const repairsInDryRun = await executeTopicAutoSync(topics, sessions, 'user-preview-123', {
      isDryRun: true,
      updateDocFn: mockUpdateDoc,
      logFn: mockLog,
      docFn: () => ({}),
      dbInstance: {},
    });

    assert(repairsInDryRun === 1, 'Deve detectar 1 reparo');
    assert(updateDocCallCount === 0, 'No modo Dry-Run (Preview), NENHUM updateDoc deve ser chamado!');
    assert(
      loggedMessages.some(m => m.includes('[Self-Healing: DRY RUN - Preview]')),
      'Deve registrar mensagem com prefixo [Self-Healing: DRY RUN - Preview]'
    );
    assert(
      loggedMessages.some(m => m.includes('Infectologia - Sífilis')),
      'Log de simulação deve conter o nome do tópico'
    );

    console.log('✓ 3. Execução em Dry-Run (Preview) bloqueia gravações e gera logs informativos com sucesso.');

    // Cenário B: PRODUÇÃO (Gravação permitida)
    let prodUpdatedData: any = null;
    const prodUpdateDoc = async (_ref: any, data: any) => {
      updateDocCallCount++;
      prodUpdatedData = data;
    };
    const prodLoggedMessages: string[] = [];

    const repairsInProd = await executeTopicAutoSync(topics, sessions, 'user-prod-123', {
      isDryRun: false,
      updateDocFn: prodUpdateDoc,
      logFn: (msg) => prodLoggedMessages.push(msg),
      docFn: () => ({}),
      dbInstance: {},
    });

    assert(repairsInProd === 1, 'Deve processar 1 reparo em produção');
    assert(updateDocCallCount === 1, 'Em produção, exatamente 1 updateDoc deve ter sido executado');
    assert(prodUpdatedData !== null, 'Payload de produção não deve ser nulo');
    assert(prodUpdatedData.repetitions === 1, 'Repetições gravadas devem ser 1');
    assert(prodUpdatedData.lastReviewDate === '2026-04-01T12:00:00Z', 'lastReviewDate gravada deve ser a data da sessão');
    assert(
      prodLoggedMessages.some(m => m.includes('[Self-Healing] Automatically repair out of sync topic')),
      'Log de produção deve conter [Self-Healing] padrão'
    );

    console.log('✓ 4. Execução em Produção executa updateDoc com o payload correto.');
  }

  runExecutionTests().then(() => {
    console.log('=== TODOS OS TESTES DE SELF-HEALING PASSARAM COM SUCESSO! ===');
  }).catch(err => {
    console.error('Falha nos testes de self-healing:', err);
    process.exit(1);
  });
}
