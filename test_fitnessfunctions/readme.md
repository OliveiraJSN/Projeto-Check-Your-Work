# Check Your Work — Corretor Automático de Trabalhos de Programação

> **Grupo KodeTech** · Disciplina de Arquitetura de Software
> Esthefane Belém Macedo Gome · João Oliveira Santos Neto · Luana Vitória Chacão · Pablo Carvalho dos Santos · Tiago Alexandre Moraes Jaco

---

## 1. Visão Geral do Sistema e Domínio de Negócio

### 1.1. Contexto do Projeto Selecionado

* **Architectural Kata:** Check Your Work (Corretor Automático)

* **Desafio Principal de Engenharia:** Uma universidade ampliou seus cursos de Ciência da Computação e precisa automatizar a correção de trabalhos de programação. O sistema tem de fazer quatro coisas ao mesmo tempo, e elas puxam a arquitetura para lados diferentes:
  - **Executar código não confiável** enviado pelos alunos sem deixar que ele chegue ao servidor, ao banco ou a trabalhos de outros alunos (DA04).
  - **Detectar plágio comparativo** entre os alunos. Comparar todos com todos cresce de forma quadrática com o número de submissões.
  - **Integrar-se a um LMS legado em mainframe**, que é a fonte da verdade institucional e não pode ser alterado (R01, DA08).
  - **Garantir integridade e auditabilidade das notas** (DA02, DA03). Esse é o atributo crítico do enunciado: uma nota alterada indevidamente gera contestação formal e dano à reputação da instituição.

  A carga é muito sazonal. Nos prazos de entrega, o pico fica cerca de **160× acima da média**. A capacidade de execução sai de cerca de 0,3 vCPU em média para até **140 vCPUs simultâneas** se a correção fosse síncrona. Além disso, a nota é uma decisão automatizada sobre dado pessoal (art. 20 da LGPD), então o professor precisa continuar participando da decisão e a correção precisa ser explicável e reprodutível.

### 1.2. Resumo da Solução Proposta

A equipe adotou um **estilo arquitetural híbrido** (ADR 003): um **mediador na fronteira com o legado** e um **pipeline de processamento assíncrono orientado a fila** na parte interna. Um Middleware/API Gateway funciona como camada anticorrupção (ADR 001). Ele é o único componente que conversa com o LMS Mainframe, por isso o legado conhece um só contrato e nenhum serviço novo fala direto com ele, nem para devolver a nota. O ciclo de uma submissão tem quatro fases. Primeiro vem a recepção síncrona, que devolve o protocolo na hora e garante o prazo do aluno. Depois vem o enfileiramento persistente, que absorve os picos. Em seguida, os consumidores processam de forma assíncrona. Por fim, a nota volta ao LMS por *callback*, passando pelo Middleware. Com a fila, os 140 vCPUs instantâneos deixam de ser obrigatórios e passam a ser um parâmetro ajustável pelo SLA (16 a 96 vCPUs). A queda do Corretor também deixa de causar perda de submissões.

Os três serviços principais têm quanta arquiteturais diferentes. O **Corretor Automático** prioriza o isolamento: cada trabalho roda em um **container efêmero** (cgroups, seccomp, sem rede e com rootfs somente leitura), em um host dedicado e sem credenciais (ADR 002). A equipe escolheu containers em vez de microVMs porque o tempo de inicialização é o ponto de sensibilidade para esvaziar a fila no pico. O risco de compartilhar o kernel foi aceito e é mitigado pela ausência total de rede. O **Detector de Plágio** limita a comparação aos trabalhos do mesmo enunciado e usa *fingerprinting* em vez de comparar pares diretamente. Isso reduz o processamento de uma turma de cerca de 16 horas para cerca de 19 minutos. O detector produz **evidência, não veredito**: quem decide é o professor. O **Banco de Auditoria** é *append-only*. Cada evento (submissão, correção automática, ajuste manual do docente com motivo obrigatório) vira um novo registro, e a nota vigente é só a leitura do último estado válido dessa cadeia. Cada serviço escreve apenas no próprio schema e nenhum lê dados de outro.

No código, os pacotes `Integracao`, `Correcao` e `Plagio` definem as próprias portas. As implementações concretas (Docker, broker, banco, protocolo do mainframe, motor de similaridade) ficam em pacotes `*.Adaptadores`, seguindo a Inversão de Dependência (ADR 009). Assim, a política de nota e os limiares de plágio podem ser testados sem rede, banco ou sandbox. Trocar o container por microVM ou o motor de plágio por um serviço externo passa a ser só uma troca de adaptador. **Funções de aptidão** no pipeline de CI mantêm essas decisões ao longo do tempo, entre elas: carga sintética de pico, caos com o Corretor fora do ar, suíte adversarial de submissões maliciosas, proibição de imports entre camadas, métricas de estabilidade (D = 0 nos pacotes primários) e soberania de dados. As que protegem os drivers inviabilizantes têm poder de veto sobre o *merge*. O trade-off aceito de forma consciente é perder a resposta imediata (consistência eventual da nota) e ganhar mais complexidade operacional. Em troca, o sistema ganha integridade, isolamento e proteção do legado, porque no domínio acadêmico **a integridade da nota vem antes da latência**.

---

## 8. Testes & Fitness Functions (Governança Automatizada)

### 8.1. Execução das Fitness Functions (ArchUnit)

Para garantir que as regras de dependência entre camadas definidas na **ADR 009 (rev. 2)** não sejam violadas à medida que o código evolui, a equipe transformou a **FA15** em testes de arquitetura automatizados. Como o código do Check Your Work é escrito em TypeScript, usamos o **[ArchUnitTS](https://github.com/LukasNiessen/ArchUnitTS)** (`archunit` no npm). Ele é a versão do ArchUnit para TypeScript e oferece a mesma API fluente de regras (`projectFiles().inFolder(...).shouldNot().dependOnFiles()...`).

| Item | Valor |
| --- | --- |
| Fitness function | FA15 (revisada) |
| Drivers protegidos | DA02 (integridade das notas), DA03 (auditabilidade), DA08 (integração com o LMS), DA10 (manutenibilidade) |
| Decisões protegidas | ADR 001 (camada anticorrupção) e ADR 009 rev. 2 (DIP: portas no domínio, tecnologia nos adaptadores) |
| Tipo / cadência | Atômica · a cada build, no pipeline de CI |
| Limiar | **Zero violações.** Qualquer violação reprova o build e bloqueia o *merge* |
| Ferramentas | ArchUnitTS 2.5.5 · Vitest 5.1 · TypeScript 5.9 |

#### Mapeamento das camadas

O pacote `X.Adaptadores` da ADR 009 corresponde a `src/infraestrutura/x`. Os pacotes primários e o de contratos ficam em `src/dominio`.

```text
src/
├── dominio/                       ← Domínio: regras de negócio + portas (interfaces)
│   ├── contratos/                 ← CheckYourWork.Contratos (A = 1): mensagens, IRepositorioDeAuditoria, IPublicadorDeEventos
│   ├── integracao/                ← ILmsGateway, ServicoDeRecepcaoDeSubmissao, ServicoDePublicacaoDeResultado
│   ├── correcao/                  ← ISandboxDeExecucao, IRepositorioDeCasosDeTeste, IPoliticaDeAvaliacao, ServicoDeCorrecao
│   └── plagio/                    ← IMotorDeComparacaoDeSimilaridade, IAcervoDeTrabalhos, ServicoDeDeteccaoDePlagio
└── infraestrutura/                ← Infraestrutura: implementações concretas (I = 1)
    ├── integracao/                ← LmsMainframeAdapter, LmsWebhookController, ConsumidorDeResultados
    ├── correcao/                  ← DockerGVisorSandboxAdapter, PostgresCasosDeTesteAdapter, ConsumidorDeSubmissoesCorrecao
    ├── plagio/                    ← WinnowingFingerprintAdapter, PostgresAcervoAdapter, ConsumidorDeSubmissoesPlagio
    └── comum/                     ← RabbitMqPublicadorAdapter, PostgresAuditoriaAdapter
```

#### Regra Validada 1 — A camada de Domínio não possui referência direta para a camada de Infraestrutura

Essa regra é verificada de três formas complementares:

* **1a. Imports entre arquivos.** Nenhum arquivo de `src/dominio/**` importa arquivo de `src/infraestrutura/**`. O domínio conhece apenas as próprias portas.
* **1b. Imports de bibliotecas de tecnologia.** Nenhum arquivo de domínio importa `pg`, `amqplib`, `dockerode`, cliente HTTP ou `child_process`. Isso impede que a tecnologia entre no domínio pelo `node_modules`, sem passar por um adaptador.
* **1c. Ciclos.** Os pacotes de domínio não formam ciclos de dependência (Princípio das Dependências Acíclicas).

```ts
it('1a. nenhum arquivo de src/dominio importa arquivo de src/infraestrutura', async () => {
  const regra = projectFiles()
    .inFolder('src/dominio/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/infraestrutura/**');

  await expect(regra).toPassAsync();
});
```

#### Regra Validada 2 — Todas as classes de repositório implementam uma interface abstrata correspondente

Repositório, aqui, é todo adaptador de persistência (`Postgres*Adapter`). A regra lê a **árvore sintática** de cada arquivo e não faz busca por texto. Toda classe declarada precisa ter `implements` de uma interface importada de `src/dominio`. Implementar uma interface definida em outro adaptador não conta. Uma segunda regra garante que nenhum repositório concreto foi criado dentro do domínio.

| Repositório concreto (Infraestrutura) | Interface abstrata (Domínio) |
| --- | --- |
| `PostgresAuditoriaAdapter` | `Contratos.IRepositorioDeAuditoria` (só `registrar()`, append-only) |
| `PostgresCasosDeTesteAdapter` | `Correcao.IRepositorioDeCasosDeTeste` |
| `PostgresAcervoAdapter` | `Plagio.IAcervoDeTrabalhos` (escopo por enunciado, id pseudônimo) |

```ts
it('2a. todo repositório (Postgres*Adapter) implementa uma porta declarada em src/dominio', async () => {
  const regra = projectFiles()
    .inFolder('src/infraestrutura/**')
    .withName(/^Postgres.*Adapter\.ts$/)
    .should()
    .adhereTo(implementaInterfaceDoDominio, 'Repositório deve implementar interface abstrata do Domínio');

  await expect(regra).toPassAsync();
});
```

#### Como executar

```bash
npm ci
npm run test:arquitetura
```

O workflow `.github/workflows/fitness-functions.yml` roda o mesmo comando em todo *pull request*. Com a *branch protection* exigindo esse *check*, uma violação bloqueia o *merge*.

#### Resultado da execução

```text
 ✓ Regra 1 — Domínio não referencia Infraestrutura
   ✓ 1a. nenhum arquivo de src/dominio importa arquivo de src/infraestrutura
   ✓ 1b. nenhum arquivo de src/dominio importa biblioteca de tecnologia (pg, amqplib, dockerode, HTTP...)
   ✓ 1c. os pacotes de domínio não formam ciclos de dependência (ADP)
 ✓ Regra 2 — Repositórios implementam interface abstrata do Domínio
   ✓ 2a. todo repositório (Postgres*Adapter) implementa uma porta declarada em src/dominio
   ✓ 2b. repositórios só existem na Infraestrutura (nenhum Postgres*Adapter dentro do Domínio)

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

#### Prova de que as regras detectam violações

Um teste que nunca falha não protege nada. Por isso, a equipe injetou de propósito duas violações típicas do "atalho" que a ADR 009 proíbe, executou a suíte e depois desfez as alterações:

1. `ServicoDeCorrecao` (domínio) passou a importar `DockerGVisorSandboxAdapter` e o driver `pg` diretamente.
2. `PostgresAcervoAdapter` deixou de declarar `implements IAcervoDeTrabalhos`.

```text
 × 1a. nenhum arquivo de src/dominio importa arquivo de src/infraestrutura
   → File dependency violation:
     src/dominio/correcao/ServicoDeCorrecao.ts → src/infraestrutura/correcao/DockerGVisorSandboxAdapter.ts
 × 1b. nenhum arquivo de src/dominio importa biblioteca de tecnologia
   → Custom file condition violation: src/dominio/correcao/ServicoDeCorrecao.ts
 × 2a. todo repositório (Postgres*Adapter) implementa uma porta declarada em src/dominio
   → Custom file condition violation: src/infraestrutura/plagio/PostgresAcervoAdapter.ts

 Tests  3 failed | 2 passed (5)
```

As três regras afetadas acusaram exatamente os arquivos alterados, e as outras duas continuaram passando. Depois que as alterações foram desfeitas, a suíte voltou a **5/5 aprovados**.

#### O que essas regras garantem para a arquitetura

* **ADR 001 continua de pé:** o formato do mainframe só existe no `LmsMainframeAdapter`, e nenhum tipo do LMS chega a Correção ou Plágio.
* **DA02 / LGPD art. 20 verificáveis:** a política de nota e os limiares de plágio ficam em pacotes de domínio sem dependência de rede, banco ou sandbox. Por isso dá para testá-los com dublês.
* **Troca de tecnologia vira troca de adaptador:** migrar de container para microVM (ADR 002) ou de *winnowing* para um serviço externo (ADR 006) não toca no domínio, e a FA15 prova isso a cada build.