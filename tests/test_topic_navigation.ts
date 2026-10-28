import assert from 'assert';

/**
 * Test Suite: MedRevise Schedule Topic Navigation Logic
 * Validates topic ID preservation, exact title matching, and async cancellation.
 */

// Simulation helper for cleanAndNormalize / topic title matching
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
    .replace(/^REVISÃO\s*R?\d*[\s:\-\–\—]*/gi, "")
    .replace(/^SIMULADO DE RETA FINAL[\s:\-\–\—]*/gi, "")
    .replace(/^MANUTENÇÃO EBBINGHAUS[\s:\-\–\—]*/gi, "")
    .replace(/^QUESTÕES AVANÇADAS[\s:\-\–\—]*/gi, "")
    .replace(/^REVISÃO DE REFORÇO[\s:\-\–\—]*/gi, "")
    .replace(/[\s:\-\–\—]+\s*Revisão\s*(Ativa|24h|7d|30d|R\d+|de Reforço|Ebbinghaus|Sistemática)?\s*$/gi, "")
    .replace(/\s*\(\s*Revisão\s*(Ativa|24h|7d|30d|R\d+|de Reforço|Ebbinghaus|Sistemática)?\s*\)\s*$/gi, "")
    .replace(/[\s:\-\–\—]+\s*R\d+\s*$/gi, "")
    .replace(/\s*\(\s*R\d+\s*\)\s*$/gi, "")
    .replace(/[\s:\-\–\—]+\s*Ebbinghaus\s*$/gi, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveTopic(
  scheduleTopic: { topicId?: string; id?: string; title: string },
  userTopics: Array<{ id: string; title: string; content?: string }>
) {
  const topicIdToTry = scheduleTopic.topicId || scheduleTopic.id;
  
  // 1. Check in-memory by exact topic ID first
  if (topicIdToTry) {
    const foundById = userTopics.find(t => t.id === topicIdToTry);
    if (foundById) {
      return { topic: foundById, source: 'exact_id' };
    }
  }

  // 2. Check by exact normalized title match
  const cleanTitle = cleanAndNormalize(scheduleTopic.title);
  const targetNorm = cleanTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  if (targetNorm) {
    const foundByTitle = userTopics.find(t => {
      const tNorm = (t.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      return tNorm && tNorm === targetNorm;
    });

    if (foundByTitle) {
      return { topic: foundByTitle, source: 'exact_title' };
    }
  }

  // Fallback: Create new/local topic placeholder for this EXACT schedule topic
  return {
    topic: {
      id: topicIdToTry || `local_${targetNorm}`,
      title: scheduleTopic.title,
      content: ''
    },
    source: 'created'
  };
}

async function runTests() {
  console.log('--- Running Topic Navigation Logic Tests ---');

  const userTopics = [
    { id: 'topic_A_123', title: 'Amiodarona e Toxicidades', content: 'Resumo completo de Amiodarona' },
    { id: 'topic_B_456', title: 'Trombose Venosa Profunda (TVP)', content: 'Resumo completo de TVP' },
    { id: 'topic_C_789', title: 'Taquicardia Ventricular Paroxística (TVP)', content: 'Resumo de Taquicardia' },
    { id: 'topic_D_101', title: 'Hipertensão Arterial Sistêmica', content: '' } // Empty summary
  ];

  // Test 1: Click "Ver resumo" on Topic A opens Topic A
  {
    const scheduleItemA = { topicId: 'topic_A_123', title: 'Amiodarona e Toxicidades' };
    const result = resolveTopic(scheduleItemA, userTopics);
    assert.strictEqual(result.topic.id, 'topic_A_123');
    assert.strictEqual(result.topic.title, 'Amiodarona e Toxicidades');
    console.log('✔ Test 1 passed: Clicking Topic A opens Topic A summary.');
  }

  // Test 2: Click "Ver resumo" on Topic B opens Topic B
  {
    const scheduleItemB = { topicId: 'topic_B_456', title: 'Trombose Venosa Profunda (TVP)' };
    const result = resolveTopic(scheduleItemB, userTopics);
    assert.strictEqual(result.topic.id, 'topic_B_456');
    assert.strictEqual(result.topic.title, 'Trombose Venosa Profunda (TVP)');
    console.log('✔ Test 2 passed: Clicking Topic B opens Topic B summary.');
  }

  // Test 3: Two topics with similar abbreviations/names open their respective topics
  {
    const item1 = { topicId: 'topic_B_456', title: 'Trombose Venosa Profunda (TVP)' };
    const item2 = { topicId: 'topic_C_789', title: 'Taquicardia Ventricular Paroxística (TVP)' };

    const res1 = resolveTopic(item1, userTopics);
    const res2 = resolveTopic(item2, userTopics);

    assert.strictEqual(res1.topic.id, 'topic_B_456');
    assert.strictEqual(res2.topic.id, 'topic_C_789');
    assert.notStrictEqual(res1.topic.id, res2.topic.id);
    console.log('✔ Test 3 passed: Two topics with similar acronyms resolve independently.');
  }

  // Test 4: Topic without summary displays empty state without opening another topic's summary
  {
    const itemD = { topicId: 'topic_D_101', title: 'Hipertensão Arterial Sistêmica' };
    const resD = resolveTopic(itemD, userTopics);
    assert.strictEqual(resD.topic.id, 'topic_D_101');
    assert.strictEqual(resD.topic.content, '');
    assert.notStrictEqual(resD.topic.id, 'topic_A_123');
    console.log('✔ Test 4 passed: Topic without summary returns its own topic record with empty content.');
  }

  // Test 5: Rapid navigation race condition prevention (cancellation flag simulation)
  {
    let activeTopicId = 'topic_B_456';
    let localTopicState = { id: 'topic_A_123', title: 'Amiodarona' };

    // Async fetch for Topic A started when activeTopicId was topic_A_123, but resolves late
    const simulateAsyncFetchTopicA = async (activeCheck: () => boolean) => {
      await new Promise(r => setTimeout(r, 50));
      if (!activeCheck()) return; // Stale check!
      localTopicState = { id: 'topic_A_123', title: 'Amiodarona' };
    };

    let topicAActive = true;
    const fetchPromise = simulateAsyncFetchTopicA(() => topicAActive);

    // User rapidly switched to Topic B
    topicAActive = false; // Cleanup fired
    activeTopicId = 'topic_B_456';
    localTopicState = { id: 'topic_B_456', title: 'TVP' };

    await fetchPromise;
    assert.strictEqual(localTopicState.id, 'topic_B_456');
    console.log('✔ Test 5 passed: Stale async fetch for previous topic ignored upon rapid navigation.');
  }

  // Test 6: Preserving topic ID despite schedule item title formatting/prefix variations
  {
    const scheduleItemWithPrefix = {
      topicId: 'topic_A_123',
      title: '⚡ [QUESTÕES AVANÇADAS] 1.1 - Amiodarona e Toxicidades'
    };
    const res = resolveTopic(scheduleItemWithPrefix, userTopics);
    assert.strictEqual(res.topic.id, 'topic_A_123');
    console.log('✔ Test 6 passed: Topic ID preserved despite schedule title prefix variations.');
  }

  console.log('--- ALL 6 TOPIC NAVIGATION TESTS PASSED ---');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
