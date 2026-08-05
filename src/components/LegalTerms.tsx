import React, { useState, useEffect } from 'react';
import { Shield, ScrollText, Scale, Eye, AlertCircle, FileLock, AlertTriangle, X as CloseIcon } from 'lucide-react';

interface LegalTermsProps {
  initialSection?: 'terms' | 'privacy';
  onClose?: () => void;
}

export default function LegalTerms({ initialSection = 'terms', onClose }: LegalTermsProps) {
  const [activeSection, setActiveSection] = useState<'terms' | 'privacy'>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="bg-white border-2 border-[#141414] p-6 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] relative">
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 border border-[#141414] bg-[#E4E3E0]/10 hover:bg-[#141414]/5 transition-colors cursor-pointer"
            title="Fechar"
          >
            <CloseIcon size={16} />
          </button>
        )}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pr-8">
          <div className="flex items-center gap-3">
            <Scale className="text-neutral-700 shrink-0" size={32} />
            <div>
              <h3 className="font-serif italic text-2xl font-bold text-neutral-900">Documentação Legal</h3>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#D44E3D] mt-1">
                Conformidade Comercial, Proteção de Dados, LGPD & Isenção de Responsabilidade Clínica
              </p>
            </div>
          </div>
          
          <div className="inline-flex border border-[#141414] p-0.5 bg-[#E4E3E0]/20 shrink-0">
            <button 
              onClick={() => setActiveSection('terms')}
              className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                activeSection === 'terms' ? 'bg-[#141414] text-white font-bold' : 'hover:bg-neutral-50 text-neutral-500'
              }`}
            >
              Termos de Uso
            </button>
            <button 
              onClick={() => setActiveSection('privacy')}
              className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                activeSection === 'privacy' ? 'bg-[#141414] text-white font-bold' : 'hover:bg-[#141414]/5 text-neutral-500'
              }`}
            >
              Política de Privacidade
            </button>
          </div>
        </div>
      </div>

      {activeSection === 'terms' ? (
        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-6 text-[#141414] leading-relaxed">
          <div className="flex items-center gap-2 border-b border-[#141414]/15 pb-4">
            <ScrollText size={18} className="text-indigo-600" />
            <h4 className="font-serif text-lg italic font-bold">Termos de Serviço e Uso do Ecossistema MedRevise & MedInternato</h4>
          </div>

          {/* CRITICAL LIABILITY DISCLOSER SHIELD */}
          <div className="bg-rose-50 border-2 border-rose-600 p-5 rounded-xl flex gap-4 text-rose-950 shadow-sm">
            <AlertTriangle size={32} className="shrink-0 text-rose-600" />
            <div className="space-y-2">
              <span className="font-bold text-xs uppercase tracking-wide text-rose-800 block">
                AVISO DE ISENÇÃO DE RESPONSABILIDADE MÉDICA INDISPENSÁVEL (DISCLAIMER)
              </span>
              <p className="text-[11px] leading-relaxed text-rose-900 font-sans">
                As plataformas <strong>MedRevise</strong> e <strong>MedInternato</strong>, incluindo o <strong>Mentor de Conduta Clínica IA</strong>, geradores de casos, simuladores de estudos, resumos e quaisquer outras ferramentas baseadas em Inteligência Artificial, são de natureza <strong>estritamente educativa, pedagógica e informativa</strong>. 
              </p>
              <p className="text-[11px] leading-relaxed text-rose-900 font-sans font-semibold">
                Sistemas de Inteligência Artificial estão sujeitos a falhas graves, "alucinações", lapsos lógicos, imprecisões científicas e desatualização em relação às diretrizes médicas mais recentes de sociedades médicas e conselhos profissionais.
              </p>
              <p className="text-[11px] leading-relaxed text-rose-900 font-sans">
                <strong>O USUÁRIO ASSUME INTEGRAL E EXCLUSIVA RESPONSABILIDADE</strong> por confirmar, revisar e validar de forma independente qualquer informação, diagnóstico, medicamento, dosagem ou recomendação clínica fornecida por esta plataforma antes de sua aplicação em pacientes reais ou tomada de decisões de saúde. Sob nenhuma hipótese os criadores, desenvolvedores, mantenedores ou parceiros da plataforma serão responsabilizados por quaisquer danos diretos, indiretos, incidentais ou consequentes resultantes de condutas clínicas ou negligências decorrentes do uso das informações aqui contidas.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs font-sans">
            <p className="text-[10px] font-mono uppercase text-neutral-400">Última atualização: 11 de julho de 2026</p>
            
            <section className="space-y-2">
              <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-800">1. Aceitação dos Termos e Escopo</h5>
              <p className="text-neutral-600">
                Ao registrar-se e utilizar as plataformas MedRevise e/ou MedInternato ("Serviço"), você concorda em cumprir e estar totalmente vinculado a estes Termos de Uso. Se você não concorda com qualquer parte destes termos, não deve utilizar nenhum módulo do sistema.
              </p>
            </section>

            <section className="space-y-2">
              <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-800">2. Descrição das Ferramentas e Faturamento Híbrido (Freemium)</h5>
              <p className="text-neutral-600">
                O ecossistema disponibiliza diferentes módulos voltados ao aprimoramento do raciocínio médico:
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-500 pl-2">
                <li><strong>Módulo MedRevise:</strong> Plataforma de memorização ativa através de cartões de memória (flashcards) e repetição espaçada (algoritmo SM-2 modificado).</li>
                <li><strong>Módulo MedInternato:</strong> Plataforma de simulação clínica de casos práticos e conduta médica, banco de questões comentadas de residência e mentoria clínica assistida por Inteligência Artificial (Mentor IA).</li>
                <li><strong>Limitações de Conta (Freemium):</strong> Contas gratuitas estão limitadas a uma cota diária de interações de IA (limite padrão de 10 requisições diárias), criação de até 3 matérias e 5 tópicos. Contas Premium (Planos MedRevise Pro, MedInternato Premium e Combo Ouro) possuem limites ampliados de cotas de IA diárias e recursos ilimitados, conforme descrito no momento da contratação.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-800">3. Condições de Pagamento, Reembolso e Assinatura</h5>
              <p className="text-neutral-600">
                As assinaturas dos planos Pro/Premium são processadas via MercadoPago de forma recorrente ou pontual conforme a oferta vigente. O reembolso integral é garantido em até 7 dias corridos após a contratação (Direito de Arrependimento), em conformidade com o Código de Defesa do Consumidor brasileiro. Solicitações de cancelamento interrompem futuras cobranças automáticas instantaneamente.
              </p>
            </section>

            <section className="space-y-2">
              <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-800">4. Propriedade Intelectual e Uso de Imagens</h5>
              <p className="text-neutral-600">
                Todo o código-fonte, marcas, layouts visuais e algoritmos proprietários do MedRevise e MedInternato são de propriedade exclusiva dos criadores. 
              </p>
              <p className="text-neutral-600">
                <strong>Direitos de Imagem:</strong> As pranchas ilustrativas didáticas fornecidas nos resumos são de caráter estritamente educativo e têm fins acadêmicos. A plataforma prioriza a citação e indicação de fontes de domínio público, permitindo também ao usuário o upload e customização de suas próprias referências visuais para uso exclusivamente pessoal e privado, isentando a plataforma de qualquer violação de propriedade de terceiros efetuada individualmente pelo usuário.
              </p>
            </section>

            <section className="space-y-2">
              <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-800">5. Limitação Absoluta de Responsabilidade e Risco Médico</h5>
              <p className="text-neutral-600">
                O Serviço não constitui conselho médico profissional, consulta, diagnóstico ou plano de tratamento. Nós não garantimos aprovação em concursos de Residência Médica, provas do Revalida, exames de faculdade ou proficiência. A aplicação prática de qualquer conduta estudada nos simuladores é de risco integral e exclusivo do profissional ou estudante atuante.
              </p>
            </section>

            <section className="space-y-2 border-t border-neutral-100 pt-4">
              <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-800">6. Blindagem Jurídica, Direitos Autorais & Canais de Contato</h5>
              <p className="text-neutral-600">
                Para resguardar a integridade civil e criminal dos desenvolvedores e da plataforma, em estrito cumprimento com o Código de Defesa do Consumidor, com a Lei Geral de Proteção de Dados (LGPD) e diretrizes de propriedade intelectual:
              </p>
              <div className="bg-neutral-50 border border-[#141414]/10 p-4 font-mono text-[11px] text-neutral-700 space-y-2.5">
                <div>
                  <span className="font-bold text-neutral-900 block">✓ CANAL OFICIAL EXCLUSIVO DE ATENDIMENTO</span>
                  <p className="mt-0.5">Para suporte técnico, faturamento, pedidos de reembolso em até 7 dias, dúvidas sobre os termos, requisições de dados da LGPD ou disputas civis, envie um email formal para: <span className="font-bold text-indigo-600 select-all">medreviseofc@gmail.com</span>.</p>
                </div>
                <div>
                  <span className="font-bold text-neutral-900 block">✓ CLÁUSULA DE MEDIAÇÃO PRÉVIA ADMINISTRATIVA</span>
                  <p className="mt-0.5">O usuário aceita e concorda voluntariamente que, antes de adotar qualquer medida judicial, administrativa externa ou postulações públicas de reclamação de consumo, deverá obrigatoriamente formalizar seu pleito por escrito através do email oficial acima. Compromete-se a colaborar de boa-fé e aguardar o prazo de resolução amigável de até 5 dias úteis, visando à conciliação extrajudicial célere.</p>
                </div>
                <div>
                  <span className="font-bold text-neutral-900 block">✓ NOTIFICAÇÕES DE DIREITOS AUTORAIS (DMCA)</span>
                  <p className="mt-0.5">Se você identificar qualquer imagem, prancha didática ou texto que infrinja seus direitos autorais, envie uma notificação contendo o link e comprovação de autoria para o e-mail oficial para remoção imediata e amigável da plataforma.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-6 text-[#141414] leading-relaxed">
          <div className="flex items-center gap-2 border-b border-[#141414]/15 pb-4">
            <Eye size={18} className="text-emerald-600" />
            <h4 className="font-serif text-lg italic font-bold">Diretriz de Privacidade & Proteção de Dados</h4>
          </div>

          <div className="space-y-4 text-xs font-sans">
            <p className="text-[10px] font-mono uppercase text-neutral-400">Última atualização: 11 de julho de 2026</p>

            <section className="space-y-2">
              <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-800">1. Coleta Temática de Dados e Escopo de Aplicações</h5>
              <p className="text-neutral-600">
                Para prover o funcionamento correto do ecossistema integrado (MedRevise & MedInternato), coletamos e armazenamos de forma persistente e protegida em nossos servidores de banco de dados (Firebase Firestore) as seguintes informações:
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-500 pl-2">
                <li>Informações cadastrais obtidas do login social com Google (nome completo, e-mail de contato e link da imagem de perfil).</li>
                <li>Seu roteiro estruturado de matérias, tópicos, resumos e anotações gerados.</li>
                <li>Seu progresso de revisões espaçadas, cartões de memória criados e estatísticas de erros em simulados e questões de fixação.</li>
                <li>Logs de consumo de cotas de IA para conformidade de faturamento e prevenção de abusos de API.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-800">2. Conformidade com a LGPD</h5>
              <p className="text-neutral-600">
                Atuamos em estrita conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Suas estatísticas de retenção e informações de perfil são exclusivamente de uso pessoal e privado. Nós jamais venderemos ou compartilharemos seus dados para fins comerciais ou publicitários com quaisquer terceiros.
              </p>
            </section>

            <section className="space-y-2">
              <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-800">3. Uso de Escopos do Google Calendar</h5>
              <p className="text-neutral-600">
                O sistema oferece sincronização opcional com o Google Calendário. O token de autorização gerado é criptografado e mantido em um banco de segredos inacessível ao cliente comum, sendo requisitado exclusivamente para injetar as tarefas de matérias de forma pontual no seu calendário Google pessoal.
              </p>
            </section>

            <section className="space-y-2">
              <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-800">4. Exclusão Permanente de Contas</h5>
              <p className="text-neutral-600">
                Em alinhamento direto com o princípio de autodeterminação informativa da LGPD, você possui direito à portabilidade e exclusão total de dados a qualquer momento. Você pode realizar o reset instantâneo e total de todas as suas tabelas de dados na plataforma acessando a aba "Perfil" e clicando na opção de "Resetar Tudo".
              </p>
            </section>

            <div className="bg-emerald-50 border border-emerald-250 p-4 flex gap-3 text-emerald-950">
              <FileLock size={20} className="shrink-0 text-emerald-600" />
              <div>
                <span className="font-bold text-[11px] block">Servidores Escalonados e Seguros</span>
                <span className="text-[10px] text-emerald-800 block mt-0.5">Seus dados e relatórios estão protegidos por regras de controle de acesso Baseadas em Atributos (ABAC) e certificados SSL/TLS em todas as conexões de tráfego.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
