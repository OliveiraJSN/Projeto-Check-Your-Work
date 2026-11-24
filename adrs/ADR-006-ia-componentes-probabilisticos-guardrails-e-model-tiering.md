# ADR-006 — Integração de Componentes Probabilísticos, Guardrails de IA e Model Tiering

| Campo | Valor |
|---|---|
| **Status** | Proposto |
| **Data** | 2026-11-23 |
| **Decisores** | Grupo KodeTech |
| **Origem** | **Nova** na Sprint 4. Atende ao entregável do kata: "ADR de Model Tiering (SLM local × LLM em nuvem)" |
| **Relacionadas** | ADR-001 (quarto serviço), ADR-002 (portas e Strategy), ADR-004 (ACL para o provedor), ADR-005 (pgvector, servidor de inferência); BKL-007 (versionamento do corretor), BKL-008 (retenção e pseudonimização) |
| **Drivers** | DA02, DA03, DA04, DA05, DA07, DA09; R02, R05 |

## Contexto

O kata exige **correção semântica e análise de código por IA Generativa**. Isso introduz pela primeira vez um componente **probabilístico** num sistema cujo driver mais crítico é a **integridade e a reprodutibilidade da nota** (DA02), com o professor obrigatoriamente no circuito (art. 20 da LGPD).

Quatro tensões precisam ser resolvidas:

1. **Determinismo × probabilismo.** O mesmo código pode gerar duas respostas. A nota precisa ser reproduzível (FA11).
2. **Privacidade × qualidade.** Modelos em nuvem tendem a ser mais capazes, mas enviam código de aluno (dado pessoal) para fora (DA09; LGPD, arts. 33–36).
3. **Custo × cobertura.** Chamar um modelo grande para cada submissão no pico não cabe no orçamento.
4. **Confiança × segurança.** O código do aluno é hostil (R02) e agora é entrada de prompt, com risco de *prompt injection*.

## Decisão

### D1. A IA sugere; a política e o professor decidem
A nota oficial continua sendo calculada por `IPoliticaDeAvaliacao` a partir dos casos de teste. A IA produz um **Parecer Semântico** (critérios, pontuação sugerida, justificativas com evidências e confiança). O parecer só entra no cálculo se o professor habilitar no enunciado, **e** nada gerado por modelo vai ao LMS sem aprovação do professor.

### D2. Serviço próprio, atrás de uma ACL
A IA vive no **Serviço de Análise Semântica** (ADR-001), com fila própria (`cyw.semantica`), pool próprio (bulkhead) e esquema próprio. O provedor é tratado como sistema externo e não confiável, acessado pela porta `IAvaliadorSemantico` (ADR-004), com um adaptador por modelo (Adapter) criado por fábrica (Factory Method) e com a escolha do tier por `IEstrategiaDeTier` (Strategy).

### D3. Model Tiering em dois níveis

| | **Tier 1: SLM local** | **Tier 2: LLM em nuvem** |
|---|---|---|
| Quando | **Todas** as submissões | Só quando o Tier 1 não resolve com confiança, ou por pedido do professor |
| Onde roda | Infraestrutura da universidade | API de provedor externo |
| Custo | Fixo e previsível | Variável, com teto de orçamento |
| Privacidade | O dado não sai | Sai, só pseudonimizado e **só depois** da análise LGPD concluída |
| Estado inicial | Ligado | **Desligado** por *feature flag* |

**Escalonamento ao Tier 2** (qualquer condição): `confianca` do Tier 1 abaixo do limiar; saída do Tier 1 inválida duas vezes seguidas; submissão acima do limite de tokens do SLM; enunciado marcado como "revisão aprofundada".
**Rebaixamento (fallback):** se o Tier 2 estiver indisponível ou o circuito estiver aberto, usa-se o resultado do Tier 1 com marca de baixa confiança. Se ambos falharem, o parecer fica "indisponível" e é reprocessado depois; a correção por testes **não** é afetada.

### D4. RAG com contexto do professor
O banco vetorial (pgvector, ADR-005) guarda, **por `enunciadoId`**, o enunciado, a rubrica e soluções/submissões já corrigidas e aprovadas pelo professor, usadas como exemplos *few-shot*. O corpus é pseudonimizado e separado do acervo de plágio.

### D5. Guardrails obrigatórios (nenhuma resposta de modelo entra no domínio sem passar por todos)

| # | Guardrail | Resumo |
|---|---|---|
| G1 | Higienização de PII | Nome, e-mail, matrícula, `alunoId`, CPF, telefone e URLs pessoais removidos/tokenizados **antes** de qualquer chamada; o `alunoId` nunca vai ao modelo |
| G2 | Isolamento de prompt | Código do aluno entre delimitadores aleatórios, tratado como **dado**; detector de injeção marca a submissão para revisão humana |
| G3 | Saída estruturada | JSON Schema estrito (`additionalProperties: false`, faixas, enums); inválido duas vezes ⇒ "parecer indisponível" |
| G4 | Ancoragem | Cada justificativa cita linha existente ou caso de teste real; sem evidência verificável, é descartada; incoerência com a execução reduz a confiança |
| G5 | Humano no circuito | Parecer é sugestão; nota oficial vem da política |
| G6 | Limites | Teto de tokens, de chamadas/min e de gasto diário; timeout e circuit breaker |
| G7 | Auditabilidade | Evento `PARECER_IA_GERADO` (só INSERT): modelo, versão do prompt, *hash* de entrada e saída, tier e confiança |
| G8 | Sem veredito disciplinar | O esquema não tem campo de plágio ou má-fé |

### D6. Reprodutibilidade
`versaoDoCorretor` passa a incluir **modelo + versão do prompt + versão da rubrica**. Parâmetros determinísticos (`temperature = 0`, *seed* quando possível) e cache por `hash(código normalizado + versaoDoCorretor)`. Trocar de modelo ou de prompt **muda a versão** e exige passar no conjunto-ouro (FA27).

## Alternativas avaliadas

| Alternativa | Por que foi rejeitada |
|---|---|
| **IA calcula a nota diretamente** | Viola DA02 e o art. 20 da LGPD: nota não reproduzível e sem o professor no circuito |
| **Só LLM em nuvem para tudo** | Todo código de aluno sairia da universidade (DA09); custo imprevisível no pico (160×); dependência total de um provedor |
| **Só SLM local para tudo** | Pode não ter qualidade em casos ambíguos; sem válvula de escape para casos difíceis |
| **IA embutida no serviço de Correção** | Uma IA lenta ou cara degradaria a correção por testes no pico; mistura de atributos de qualidade (contra o critério do *quantum*) |
| **Fine-tuning de um modelo próprio** | Exige dados rotulados e infraestrutura que o projeto não tem; o RAG entrega a personalização por professor sem treinar |
| **Confiar na instrução "responda em JSON" sem validar** | Modelos descumprem formato; sem validação, lixo entra no domínio |
| **Sem humano no circuito (auto-aprovação do parecer)** | Contraria o art. 20 e a política de professor-no-circuito dos documentos anteriores |
| **Agente autônomo com ferramentas (executar código, abrir arquivos)** | Amplia a superfície de ataque (R02); a execução já tem sandbox próprio e não deve ser acionada pelo modelo |

## Consequências

**Positivas**
- A integridade da nota (DA02) é preservada: o componente probabilístico fica restrito a evidência.
- A falha da IA degrada, não derruba: a escada de prioridades (aceitar > corrigir > entregar > parecer > plágio) fica explícita.
- Privacidade por padrão: sem Tier 2, nenhum dado sai da universidade; com ele, só pseudonimizado.
- Trocar de modelo ou de provedor é troca de adaptador, medida por um conjunto-ouro.

**Negativas / o que sacrificamos**
- Mais um serviço, uma fila, um esquema e hardware de inferência para operar.
- Esforço de curadoria: rubricas e exemplos corrigidos precisam ser mantidos pelo professor para o RAG funcionar.
- O parecer perde parte do apelo de "correção totalmente automática": o professor continua revisando.
- A qualidade real do SLM é desconhecida até o benchmark; pode obrigar a usar mais o Tier 2.
- Sanitização de PII por regras não é perfeita (falso-negativo possível); por isso há teste dedicado e o Tier 2 só liga após análise jurídica.

## Pontos em aberto (precisam de decisão da equipe antes de mudar o status para Aprovado)

| Pendência | Quem decide |
|---|---|
| Qual SLM e qual servidor de inferência, conforme o hardware disponível | Equipe + TI da universidade |
| Qual provedor de LLM e quando ligar o Tier 2 (parecer LGPD, contrato de tratamento de dados) | Equipe + jurídico/DPO |
| Limiar de `confianca` para escalonar e limiar mínimo de concordância com professores (FA27) | Definir após o benchmark com o conjunto-ouro |
| Retenção do texto dos pareceres e do corpus RAG | BKL-008 (retenção e pseudonimização) |

## Governança (funções de aptidão)

| ID | Verifica | Limiar |
|---|---|---|
| FA23 (nova) | Caos de IA: derrubar Tier 2 e depois Tier 1 durante o pico | Correção por testes mantém o SLA; parecer cai de tier e fica pendente |
| FA25 (nova) | Vazamento de PII: corpus sintético com dados plantados; captura do payload enviado ao modelo | Zero ocorrências |
| FA26 (nova) | Contrato do parecer: respostas válidas/inválidas (incluindo injeção) contra o JSON Schema e a ancoragem | 100% das inválidas rejeitadas |
| FA27 (nova) | Conjunto-ouro: concordância parecer × professor ao trocar modelo ou prompt | Não pode cair abaixo do limiar registrado; queda reprova a troca |
| FA28 (nova) | Domínio não importa SDK/adaptador de provedor de IA | Zero violações |
