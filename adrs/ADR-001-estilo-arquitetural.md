# ADR-001 — Adoção do Estilo Arquitetural (Monólito Modular vs. Microsserviços)

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-10-03 (revisada em 2026-11-23 para incluir o contêiner de IA) |
| **Decisores** | Grupo KodeTech |
| **Corresponde a** | ADR 003 da Sprint 2 ("estilo arquitetural" + "processamento assíncrono via fila") |
| **Relacionadas** | ADR-003 (protocolos), ADR-004 (contextos), ADR-006 (IA) |
| **Drivers** | DA05, DA06, DA07, DA08, DA04, DA10; R01, R04 |

## Contexto

Três forças moldam o estilo: acoplamento, comunicação e implantação. O BOTE da Sprint 1 quantificou:

- **Implantação e escala.** A carga média é de 0,3 vCPU, mas o pico do prazo exige de 16 a 96 vCPUs só para a correção (razão pico/média ≈ 160×). Quem precisa escalar é a execução; a ingestão (~7 req/s no pico) é trivial.
- **Comunicação.** O LMS não pode ficar bloqueado esperando uma correção de ~20 s. Aceitar a submissão e devolver a nota são eventos separados.
- **Acoplamento.** O LMS é imodificável (R01) e precisa de um único ponto de contrato; o código do aluno é hostil (R02) e precisa de isolamento físico.

A Sprint 4 acrescenta uma quarta força: a **correção semântica por IA Generativa** tem perfil próprio (latência de segundos, custo por token, dependência de GPU ou de provedor externo, risco de privacidade).

Pergunta do quantum arquitetural: quais partes precisam de atributos de qualidade diferentes?

| Quantum | Atributos dominantes | Perfil de carga | Dados próprios |
|---|---|---|---|
| Integração (mediador) | Disponibilidade para aceitar (DA07), contrato estável (DA08), segurança (DA01) | Leve e constante | Protocolos e estado de entrega ao LMS |
| Correção | Elasticidade (DA05, DA06), isolamento (DA04), reprodutibilidade (DA02) | Rajada de CPU nos prazos | Casos de teste e pesos |
| Plágio | Custo não linear, privacidade (DA09) | Lote pesado por enunciado | Acervo pseudonimizado |
| **Análise Semântica (IA)** | **Custo por token, latência variável, privacidade, dependência externa** | **Rajada limitada por orçamento** | **Índice vetorial por enunciado** |

## Decisão

Adotar uma **arquitetura distribuída de serviços de granularidade grossa**: quatro serviços implantáveis de forma independente (**Integração, Correção, Plágio e Análise Semântica**), cada um dono dos próprios dados, com:

1. um **mediador na fronteira com o legado** (gateway + serviço Integração) como camada anticorrupção, único ponto de contato com o LMS;
2. **comunicação interna exclusivamente assíncrona** por fila persistente, entrega ao menos uma vez, consumidores idempotentes por `submissaoId`; nenhum serviço chama outro diretamente;
3. **organização interna em Portas e Adaptadores** (ADR-002).

A granularidade é deliberadamente grossa. Um serviço só é dividido quando uma parte dele mostra atributos de qualidade diferentes do restante, e foi esse critério que justificou o quarto serviço (IA).

## Alternativas avaliadas

| Critério | Monólito em camadas | Monólito modular | Serviços + mediador síncrono | Microsserviços finos / eventos sem mediador | **Escolhido: serviços + mediador + fila** |
|---|---|---|---|---|---|
| Custo de infraestrutura | Baixo | Baixo | Alto (140 vCPUs instantâneos) | Alto | Médio: consumidores escalam a zero fora do pico |
| Facilidade de deploy | Fácil | Fácil | Complexo | Muito complexo | Moderada: 4 unidades + broker |
| Elasticidade (DA05, DA06) | Baixa: escala tudo | Baixa: escala tudo | Média: LMS bloqueado no pico | Excelente | Excelente: só a Correção escala |
| Isolamento de falhas (DA07, DA04) | Baixo | Baixo: queda de um módulo derruba a aceitação | Médio | Excelente | Alto: a fila absorve a queda de um consumidor (FA08) |
| Integração com legado (DA08) | Exige alterar o mainframe (viola R01) | Possível | Atende | Dispersa o contrato com o LMS | Atende: ponto único de contrato |
| Isolar a falha/custo da IA | Não | Parcial | Não | Sim | **Sim:** IA tem fila, pool e circuit breaker próprios |
| Testabilidade | Média | Boa | Complexa | Complexa | Boa no núcleo (DIP + dublês) |
| Rastreabilidade (DA03) | Boa | Boa | Boa | Difícil | Boa: trilha única de auditoria |

**Por que não o monólito modular**, que é a alternativa mais forte para uma equipe pequena: ele forma um único *quantum*. Para atender o pico de 16 a 96 vCPUs da correção, a ingestão escalaria junto; um estouro de memória na correção ou uma IA lenta derrubaria a aceitação de submissões justamente na janela do prazo (DA07); o lote quadrático do plágio disputaria CPU com a ingestão; e o código que executa o programa hostil compartilharia processo com as credenciais do acervo e da auditoria, ampliando o raio de dano de uma falha de isolamento (DA04).
**Condição de reversão registrada:** se o volume real ficar muito abaixo das premissas do BOTE, Correção e Plágio podem ser consolidados num só *deployable*.

**Por que não microsserviços finos:** dispersam a autenticação e o contrato com o legado, dificultam a rastreabilidade (DA03) e não se justificam no volume atual (~7 req/s).

## Consequências

**Positivas**
- A fila transforma 140 vCPUs instantâneos em parâmetro negociável pelo SLA (16 a 96 vCPUs).
- A aceitação da submissão fica independente da correção e da IA: a queda de um consumidor não perde submissões (FA08).
- Cada serviço escala, falha e é implantado sozinho; o LMS conhece um único contrato.

**Negativas / o que sacrificamos**
- Latência de resposta imediata: o LMS recebe o protocolo na hora e a nota depois (consistência eventual). Aceito porque integridade precede latência.
- Complexidade operacional: broker, quatro pipelines de deploy, rastreamento distribuído por `submissaoId`, versionamento do contrato de mensagens.
- Exceção à soberania de dados: o Banco de Auditoria recebe escrita de todos os serviços (mitigação: append-only, esquema por serviço, só INSERT).
- Ponto único de falha no mediador: mitigado com 2+ instâncias, fila persistente, retry idempotente e circuit breaker no adaptador do LMS.

## Governança (funções de aptidão)

| ID | Verifica | Limiar |
|---|---|---|
| FA07 | Carga sintética do pico (1.440 submissões em 10 min) | p95 dentro do SLA; zero recusas |
| FA08 | Caos: Correção fora por 20 min sob carga | Zero submissões perdidas ou notas duplicadas |
| FA09 / FA14 | Contrato Middleware–LMS; nenhum serviço novo referencia o LMS | Zero quebras; zero dependências diretas |
| FA17 | Soberania de dados: nenhum serviço lê esquema de outro | Zero credenciais cruzadas |
| FA23 (nova) | Caos de IA durante o pico | Correção por testes mantém o SLA |
