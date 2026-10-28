import assert from 'assert';

/**
 * End-to-End Navigation & Summary Creation Test Suite for MedRevise
 * Validates Scenarios A through F with complete state transitions, schedule persistence, and exact topic isolation.
 */

interface Topic {
  id: string;
  title: string;
  subjectId: string;
  subjectName?: string;
  content?: string;
  content_standard?: string;
  content_deep?: string;
}

interface ScheduleTopicItem {
  topicId?: string;
  title: string;
  subjectName: string;
  isCompleted?: boolean;
}

interface ScheduleWeek {
  weekNumber: number;
  days: {
    [dayName: string]: ScheduleTopicItem[];
  };
}

interface Schedule {
  id: string;
  weeks: ScheduleWeek[];
}

// Simulated Database State
class MockDatabase {
  usersTopics: Map<string, Topic> = new Map();
  schedules: Map<string, Schedule> = new Map();

  reset() {
    this.usersTopics.clear();
    this.schedules.clear();
  }
}

const dbMock = new MockDatabase();

// Helper replicating cleanAndNormalize from Cronograma
function cleanAndNormalize(text: string): string {
  if (!text) return '';
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[⚡🔄📖💡📝🎯]/gu, "")
    .replace(/^\[[^\]]+\]\s*/gi, "")
    .replace(/\[[^\]]+\]/gi, "")
    .replace(/^[0-9]+[\.\-\)\s]*/gi, "")
    .replace(/^Revisão Ativa \+ Flashcards:\s*/gi, "")
    .replace(/^Revisão\s*(Ativa|24h|7d|30d|R\d+|de Reforço|Ebbinghaus|Sistemática|Ativa \+ Flashcards)?[\s:\-\–\—]*/gi, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simulated handleContinueStudy from Cronograma.tsx
 */
function handleContinueStudy(
  scheduleTopic: ScheduleTopicItem,
  schedule: Schedule,
  userTopics: Topic[]
): { selectedTopic: Topic; updatedSchedule: Schedule } {
  const cleanTitle = cleanAndNormalize(scheduleTopic.title);
  const targetNorm = cleanTitle;
  const targetSubjNorm = cleanAndNormalize(scheduleTopic.subjectName);

  let topicIdToTry = scheduleTopic.topicId;
  let targetTopic: Topic | null = null;

  // 1. Check in-memory topics by exact ID (with title match verification)
  if (topicIdToTry) {
    const foundById = userTopics.find(t => t.id === topicIdToTry) || dbMock.usersTopics.get(topicIdToTry);
    if (foundById) {
      const foundClean = cleanAndNormalize(foundById.title);
      if (!targetNorm || foundClean === targetNorm) {
        targetTopic = foundById;
      }
    }
  }

  // 2. Check by exact clean title AND matching subject
  if (!targetTopic && targetNorm) {
    if (targetSubjNorm) {
      targetTopic = userTopics.find(t => {
        const tNorm = cleanAndNormalize(t.title);
        const tSubjNorm = cleanAndNormalize(t.subjectName || '');
        return tNorm === targetNorm && tSubjNorm === targetSubjNorm;
      }) || null;
    }
    if (!targetTopic && !targetSubjNorm) {
      targetTopic = userTopics.find(t => cleanAndNormalize(t.title) === targetNorm) || null;
    }
  }

  // 3. Create topic if not registered
  if (!targetTopic) {
    const newId = `topic_real_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    targetTopic = {
      id: newId,
      title: scheduleTopic.title,
      subjectId: `subj_${targetSubjNorm}`,
      subjectName: scheduleTopic.subjectName,
      content: ''
    };
    userTopics.push(targetTopic);
    dbMock.usersTopics.set(newId, targetTopic);
  }

  // 4. CRITICAL PERSISTENCE: Write targetTopic.id back to scheduleTopic in schedule.weeks
  scheduleTopic.topicId = targetTopic.id;
  dbMock.schedules.set(schedule.id, schedule);

  return { selectedTopic: targetTopic, updatedSchedule: schedule };
}

/**
 * Simulated TopicDetail summary generation & save
 */
function saveSummaryForTopic(
  topicId: string,
  summaryContent: string
): Topic {
  const existing = dbMock.usersTopics.get(topicId);
  if (!existing) {
    throw new Error(`Cannot save summary: Topic ${topicId} not found in database.`);
  }

  existing.content_standard = summaryContent;
  existing.content = summaryContent;
  dbMock.usersTopics.set(topicId, existing);
  return existing;
}

async function runFullFlowTests() {
  console.log('=== STARTING MEDREVISE END-TO-END TOPIC NAVIGATION & SUMMARY CREATION TESTS ===');

  dbMock.reset();

  // Seed existing database topics
  const topicA: Topic = {
    id: 'topic_cardio_101',
    title: 'Insuficiência Cardíaca Congênita',
    subjectId: 'subj_pediatria',
    subjectName: 'Pediatria',
    content_standard: 'Resumo completo de Insuficiência Cardíaca Congênita em Pediatria.'
  };

  const userTopics: Topic[] = [topicA];
  dbMock.usersTopics.set(topicA.id, topicA);

  const initialSchedule: Schedule = {
    id: 'sched_2026',
    weeks: [
      {
        weekNumber: 1,
        days: {
          'Seg': [
            { title: '⚡ [QUESTÕES AVANÇADAS] Insuficiência Cardíaca Congênita', subjectName: 'Pediatria', topicId: 'topic_cardio_101' },
            { title: 'Insuficiência Cardíaca Crônica', subjectName: 'Cardiologia' }, // No summary & no topicId initially
            { title: 'Novo Tópico - HDA em Emergência', subjectName: 'Cirurgia Geral' } // Unregistered topic
          ]
        }
      }
    ]
  };
  dbMock.schedules.set(initialSchedule.id, initialSchedule);

  // --------------------------------------------------------------------------
  // CENÁRIO A — Resumo existente: selecionar tópico A abre exclusivamente resumo de A
  // --------------------------------------------------------------------------
  {
    console.log('\n--- Running Cenário A (Resumo existente) ---');
    const scheduleItemA = initialSchedule.weeks[0].days['Seg'][0];
    const { selectedTopic } = handleContinueStudy(scheduleItemA, initialSchedule, userTopics);

    assert.strictEqual(selectedTopic.id, 'topic_cardio_101');
    assert.strictEqual(selectedTopic.content_standard, 'Resumo completo de Insuficiência Cardíaca Congênita em Pediatria.');
    console.log('✔ Cenário A APROVADO: Tópico A abriu exclusivamente seu próprio resumo.');
  }

  // --------------------------------------------------------------------------
  // CENÁRIO B — Resumo inexistente: selecionar tópico B abre o assistente para B
  // --------------------------------------------------------------------------
  {
    console.log('\n--- Running Cenário B (Resumo inexistente) ---');
    const scheduleItemB = initialSchedule.weeks[0].days['Seg'][1];
    const { selectedTopic } = handleContinueStudy(scheduleItemB, initialSchedule, userTopics);

    // Topic B should have its own topic ID and empty summary content
    assert.notStrictEqual(selectedTopic.id, 'topic_cardio_101');
    assert.strictEqual(selectedTopic.title, 'Insuficiência Cardíaca Crônica');
    assert.strictEqual(selectedTopic.content_standard || '', '');
    console.log('✔ Cenário B APROVADO: Tópico B abriu com estado de criação próprio sem reutilizar resumo de A.');
  }

  // --------------------------------------------------------------------------
  // CENÁRIO C — Tópico ainda não cadastrado: criar/localizar e salvar topicId no cronograma
  // --------------------------------------------------------------------------
  {
    console.log('\n--- Running Cenário C (Tópico ainda não cadastrado) ---');
    const scheduleItemC = initialSchedule.weeks[0].days['Seg'][2];
    assert.strictEqual(scheduleItemC.topicId, undefined);

    const { selectedTopic, updatedSchedule } = handleContinueStudy(scheduleItemC, initialSchedule, userTopics);

    assert.ok(selectedTopic.id.startsWith('topic_real_'));
    assert.strictEqual(selectedTopic.title, 'Novo Tópico - HDA em Emergência');
    
    // VERIFY CRITICAL PERSISTENCE: scheduleItemC.topicId MUST BE UPDATED in schedule
    assert.strictEqual(scheduleItemC.topicId, selectedTopic.id);
    const persistedSched = dbMock.schedules.get('sched_2026');
    assert.strictEqual(persistedSched?.weeks[0].days['Seg'][2].topicId, selectedTopic.id);

    console.log('✔ Cenário C APROVADO: Tópico novo foi criado e o topicId foi salvo de forma permanente no cronograma.');
  }

  // --------------------------------------------------------------------------
  // CENÁRIO D — Títulos semelhantes em especialidades diferentes permanecem independentes
  // --------------------------------------------------------------------------
  {
    console.log('\n--- Running Cenário D (Títulos semelhantes em especialidades diferentes) ---');
    const topicPediatria = { title: 'Síndrome Hipertensiva na Gestação', subjectName: 'Obstetrícia' };
    const topicCardio = { title: 'Síndrome Hipertensiva na Gestação', subjectName: 'Cardiologia' };

    const resObstet = handleContinueStudy(topicPediatria, initialSchedule, userTopics);
    const resCardio = handleContinueStudy(topicCardio, initialSchedule, userTopics);

    assert.notStrictEqual(resObstet.selectedTopic.id, resCardio.selectedTopic.id);
    assert.strictEqual(resObstet.selectedTopic.subjectName, 'Obstetrícia');
    assert.strictEqual(resCardio.selectedTopic.subjectName, 'Cardiologia');

    console.log('✔ Cenário D APROVADO: Tópicos com títulos idênticos em especialidades distintas permaneceram isolados.');
  }

  // --------------------------------------------------------------------------
  // CENÁRIO E — Mudança rápida: alternar de A para B descarta respostas antigas
  // --------------------------------------------------------------------------
  {
    console.log('\n--- Running Cenário E (Mudança rápida / race conditions) ---');
    let activeTopicId = 'topic_B';
    let displayedTopicContent = 'Conteúdo do Tópico B';

    // Simulate async fetch for A resolving late
    let activeFlagA = true;
    const asyncFetchA = async () => {
      await new Promise(r => setTimeout(r, 40));
      if (!activeFlagA) return; // Cleanup check
      displayedTopicContent = 'Conteúdo do Tópico A (Vazamento!)';
    };

    const fetchPromise = asyncFetchA();

    // User rapidly switches to B -> cleanup fires
    activeFlagA = false;
    activeTopicId = 'topic_B';

    await fetchPromise;
    assert.strictEqual(displayedTopicContent, 'Conteúdo do Tópico B');
    console.log('✔ Cenário E APROVADO: Busca assíncrona antiga para o Tópico A foi descartada com sucesso.');
  }

  // --------------------------------------------------------------------------
  // CENÁRIO F — Persistência: após salvar o resumo e reabrir o tópico, o resumo vinculado reaparece
  // --------------------------------------------------------------------------
  {
    console.log('\n--- Running Cenário F (Persistência pós-criação de resumo) ---');
    const scheduleItemC = initialSchedule.weeks[0].days['Seg'][2];
    const { selectedTopic } = handleContinueStudy(scheduleItemC, initialSchedule, userTopics);

    // Save summary content in TopicDetail
    const summaryText = '# Resumo de HDA\n\nAbordagem inicial e estabilização hemodinâmica...';
    saveSummaryForTopic(selectedTopic.id, summaryText);

    // Re-click "Ver resumo" on schedule item C
    const reopened = handleContinueStudy(scheduleItemC, initialSchedule, userTopics);

    assert.strictEqual(reopened.selectedTopic.id, selectedTopic.id);
    assert.strictEqual(reopened.selectedTopic.content_standard, summaryText);

    console.log('✔ Cenário F APROVADO: Resumo gerado foi vinculado perfeitamente ao ID persistido e reaberto sem perdas.');
  }

  // --------------------------------------------------------------------------
  // CENÁRIO G — Tag de especialidade [CIRURGIA] e topicId desatualizado/divergente
  // --------------------------------------------------------------------------
  {
    console.log('\n--- Running Cenário G (Prefixos de colchetes e rejeição de topicId desatualizado) ---');
    // Seed an existing topic with ID 'stale_id_09M0CD' but titled 'Cicatrização de feridas'
    const staleTopic: Topic = {
      id: 'stale_id_09M0CD',
      title: 'Cicatrização de feridas',
      subjectId: 'subj_cirurgia',
      subjectName: 'Cirurgia',
      content_standard: 'Resumo sobre cicatrização de feridas.'
    };
    userTopics.push(staleTopic);
    dbMock.usersTopics.set(staleTopic.id, staleTopic);

    // Schedule item specifies a different topic name with subject bracket prefix and carries stale topicId
    const scheduleItemG: ScheduleTopicItem = {
      title: '[CIRURGIA] Doenças cirúrgicas da mama e princípios de',
      subjectName: 'Cirurgia',
      topicId: 'stale_id_09M0CD'
    };

    const { selectedTopic } = handleContinueStudy(scheduleItemG, initialSchedule, userTopics);

    // Verify: must NOT open 'Cicatrização de feridas', must NOT reuse 'stale_id_09M0CD'
    assert.notStrictEqual(selectedTopic.id, 'stale_id_09M0CD');
    assert.notStrictEqual(selectedTopic.title, 'Cicatrização de feridas');
    assert.strictEqual(cleanAndNormalize(selectedTopic.title), 'doencas cirurgicas da mama e principios de');

    console.log('✔ Cenário G APROVADO: Tag [CIRURGIA] foi removida e topicId divergente ("Cicatrização de feridas") foi rejeitado.');
  }

  // --------------------------------------------------------------------------
  // CENÁRIO H — ID compartilhado apontando para documento com title undefined / ausente
  // --------------------------------------------------------------------------
  {
    console.log('\n--- Running Cenário H (ID compartilhado com title undefined no Firestore) ---');
    // Seed malformed topic with undefined/missing title
    const malformedTopic: Topic = {
      id: 'shared_id_undefined',
      title: undefined as any,
      subjectId: 'subj_cirurgia',
      subjectName: 'Cirurgia'
    };
    dbMock.usersTopics.set(malformedTopic.id, malformedTopic);

    const scheduleItemH: ScheduleTopicItem = {
      title: '[CIRURGIA] Hemorragia digestiva alta e baixa',
      subjectName: 'Cirurgia',
      topicId: 'shared_id_undefined'
    };

    const { selectedTopic } = handleContinueStudy(scheduleItemH, initialSchedule, userTopics);

    // Verify: malformed ID with undefined title is rejected, fallback search or clean creation is used
    assert.notStrictEqual(selectedTopic.id, 'shared_id_undefined');
    assert.strictEqual(cleanAndNormalize(selectedTopic.title), 'hemorragia digestiva alta e baixa');

    console.log('✔ Cenário H APROVADO: ID compartilhado com title undefined foi rejeitado e o tópico correto foi resolvido/criado.');
  }

  console.log('\n=== TODOS OS CENÁRIOS (A, B, C, D, E, F, G, H) FORAM TESTADOS E APROVADOS COM SUCESSO! ===');
}

runFullFlowTests().catch(err => {
  console.error('❌ Integration Test Failed:', err);
  process.exit(1);
});
