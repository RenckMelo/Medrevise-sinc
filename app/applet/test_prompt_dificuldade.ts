
import { generateQuestions } from './src/internato/services/geminiService';

async function testGeneration() {
  console.log("Iniciando teste de geração de questão...");
  try {
    // Tentativa de gerar apenas 1 questão para testar o prompt
    const questions = await generateQuestions("Hipertensão Arterial Sistêmica", "Clínica Médica", 1, [], undefined, "ENARE", 2025);
    console.log("Questão gerada com sucesso:", JSON.stringify(questions, null, 2));
  } catch (error) {
    console.error("Erro na geração:", error);
  }
}

testGeneration();
