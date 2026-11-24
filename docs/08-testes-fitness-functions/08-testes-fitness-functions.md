# 8. Testes & Fitness Functions (Governança Automatizada)

> **Projeto:** Check Your Work · **Equipe:** KodeTech
> Base: Sprint 1 (catálogo FA01–FA14), Sprint 2 (ADR 009 rev. 2, FA15–FA17 e métricas), Sprint 3 (FA19–FA22) e seção 8 escrita por Tiago (regras em ArchUnitTS).

Uma função de aptidão é um teste objetivo que mede se a arquitetura implementada continua fiel a uma decisão. A diferença entre um driver e uma função de aptidão é a mesma que existe entre intenção e verificação: "o domínio não depende de tecnologia" é intenção; "zero imports de `src/infraestrutura` em `src/dominio` a cada build" é aptidão.

> **Numeração das ADRs.** Esta seção usa a numeração da pasta [`/adrs`](../../adrs/README.md). A correspondência com os números antigos das sprints está lá. Os itens de backlog antigos aparecem com o prefixo **BKL-**.

---

## 8.1. Execução das Fitness Functions (ArchUnit)

As regras de dependência entre camadas da **ADR-002** (DIP: portas no domínio, tecnologia nos adaptadores; antiga ADR 009 rev. 2) foram transformadas na **FA15**, um teste de arquitetura automatizado. Como a stack da equipe é TypeScript/Node, a ferramenta é o **[ArchUnitTS](https://github.com/LukasNiessen/ArchUnitTS)** (pacote `archunit` no npm): é a versão do ArchUnit para TypeScript, com a mesma API fluente (`projectFiles().inFolder(...).shouldNot().dependOnFiles()...`). É o equivalente, na nossa stack, ao `dotnet test` / `mvn test` citado no checklist.

| Item | Valor |
| --- | --- |
| Fitness function | FA15 (revisada) |
| Drivers protegidos | DA02 (integridade das notas), DA03 (auditabilidade), DA08 (integração com o LMS), DA10 (modificabilidade) |
| Decisões protegidas | ADR-002 (DIP e GoF) e ADR-004 (Bounded Contexts e Camada Anti-Corrupção) |
| Tipo / cadência | Atômica · a cada build, no pipeline de CI |
| Limiar | **Zero violações.** Qualquer violação reprova o build e bloqueia o *merge* |
| Ferramentas | ArchUnitTS · Vitest · TypeScript |

### Mapeamento das camadas

O pacote `X.Adaptadores` da ADR-002 corresponde a `src/infraestrutura/x`. Os pacotes primários e o de contratos ficam em `src/dominio`.

```text
src/
├── dominio/                       ← Domínio: regras de negócio + portas (interfaces)
│   ├── contratos/                 ← Contratos (A = 1): mensagens, IRepositorioDeAuditoria, IPublicadorDeEventos
│   ├── integracao/                ← ILmsGateway, ServicoDeRecepcaoDeSubmissao, ServicoDePublicacaoDeResultado
│   ├── correcao/                  ← ISandboxDeExecucao, IRepositorioDeCasosDeTeste, IPoliticaDeAvaliacao, ServicoDeCorrecao
│   └── plagio/                    ← IMotorDeComparacaoDeSimilaridade, IAcervoDeTrabalhos, ServicoDeDeteccaoDePlagio
└── infraestrutura/                ← Infraestrutura: implementações concretas (I = 1)
    ├── integracao/                ← LmsMainframeAdapter, LmsWebhookController, ConsumidorDeResultados
    ├── correcao/                  ← DockerGVisorSandboxAdapter, PostgresCasosDeTesteAdapter, ConsumidorDeSubmissoesCorrecao
    ├── plagio/                    ← WinnowingFingerprintAdapter, PostgresAcervoAdapter, ConsumidorDeSubmissoesPlagio
    └── comum/                     ← RabbitMqPublicadorAdapter, PostgresAuditoriaAdapter
```

### Regra Validada 1 — A camada de Domínio não possui referência direta para a camada de Infraestrutura

A regra é verificada de três formas complementares:

* **1a. Imports entre arquivos.** Nenhum arquivo de `src/dominio/**` importa arquivo de `src/infraestrutura/**`. O domínio conhece apenas as próprias portas.
* **1b. Imports de bibliotecas de tecnologia.** Nenhum arquivo de domínio importa `pg`, `amqplib`, `dockerode`, cliente HTTP, `child_process` **nem SDK de provedor de IA** (FA28, ADR-006). Isso impede que a tecnologia entre no domínio pelo `node_modules` sem passar por um adaptador.
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

### Regra Validada 2 — Todas as classes de repositório implementam uma interface abstrata correspondente

Repositório, aqui, é todo adaptador de persistência (`Postgres*Adapter`). A regra lê a **árvore sintática** de cada arquivo, e não faz busca por texto. Toda classe declarada precisa ter `implements` de uma interface importada de `src/dominio`; implementar uma interface definida em outro adaptador não conta (**2a**). Uma segunda regra garante que nenhum repositório concreto foi criado dentro do domínio (**2b**).

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

### Como executar e onde roda

```bash
npm ci
npm run test:arquitetura
```

No pipeline, o mesmo comando roda em todo *pull request*. Com a *branch protection* exigindo esse *check*, uma violação bloqueia o *merge*.

### Resultado esperado e prova de que as regras detectam violações

Com o código respeitando a ADR-002, as cinco verificações (1a, 1b, 1c, 2a, 2b) passam.

Um teste que nunca falha não protege nada. Por isso a suíte precisa ser validada com violações injetadas de propósito, típicas do "atalho" que a ADR-002 proíbe:

1. `ServicoDeCorrecao` (domínio) passa a importar `DockerGVisorSandboxAdapter` e o driver `pg` diretamente → devem falhar **1a** e **1b**.
2. `PostgresAcervoAdapter` deixa de declarar `implements IAcervoDeTrabalhos` → deve falhar **2a**.

As outras verificações devem continuar passando e, depois que as alterações forem desfeitas, a suíte deve voltar a 5/5.

> **Status no repositório.** Este repositório guarda a documentação da arquitetura; o código-fonte do sistema (`src/`, `package.json` e o workflow de CI) **não está versionado aqui**. As regras acima são a especificação da FA15, e os trechos de teste são exemplos, no mesmo padrão da pasta [`docs/06-.../exemplos`](../06-resiliencia-integracao-ia-native/). A saída real da execução deve ser anexada a esta seção quando o projeto com o código for adicionado ao repositório.

### O que essas regras garantem para a arquitetura

* **A Camada Anti-Corrupção continua de pé (ADR-004):** o formato do mainframe só existe no `LmsMainframeAdapter`, e nenhum tipo do LMS chega a Correção ou Plágio.
* **DA02 e LGPD art. 20 verificáveis:** a política de nota e os limiares de plágio ficam em pacotes de domínio sem dependência de rede, banco ou sandbox, e por isso podem ser testados com dublês.
* **Troca de tecnologia vira troca de adaptador:** migrar de container para microVM (decisão de isolamento da Sprint 1) ou de *winnowing* para um serviço externo (BKL-006) não toca no domínio, e a FA15 verifica isso a cada build.

---

## 8.2. Métricas de estabilidade (FA16)

A FA16 calcula Ca, Ce, I, A e D por pacote, com a regra de contagem da Sprint 2 (conta-se classe, não dependência; só código da base; dependência interna não conta). Meta para os pacotes primários: **D = 0**; D > 0,10 ou ciclo reprova o build. Valores da Sprint 2 (Tabela 7):

| Pacote | Ca | Ce | Na | Nc | I | A | D | Posição |
|---|---|---|---|---|---|---|---|---|
| Integracao | 3 | 2 | 3 | 5 | 0,40 | 0,60 | 0 | Sequência Principal — meio estável |
| Correcao | 3 | 1 | 6 | 8 | 0,25 | 0,75 | 0 | Sequência Principal — estável e abstrato |
| Plagio | 3 | 1 | 6 | 8 | 0,25 | 0,75 | 0 | Sequência Principal — estável e abstrato |
| Contratos | 9 | 0 | 6 | 6 | 0,00 | 1,00 | 0 | Extremo estável-abstrato |
| *.Adaptadores (4 pacotes) | 0 | 2–3 | 0 | 2–3 | 1,00 | 0,00 | 0 | Extremo instável-concreto |

Fórmulas: I = Ce / (Ca + Ce) · A = Na / Nc · D = |A + I − 1|. Toda dependência aponta para um pacote mais estável (Adaptadores I = 1 → primários I = 0,25 a 0,40 → Contratos I = 0), o que atende o item "Métricas de Código" do checklist.

> O contexto novo de **Análise Semântica** (ADR-006) ainda precisa entrar nesta tabela quando os pacotes dele forem definidos.

---

## 8.3. Catálogo das funções de aptidão

| ID | Driver | O que verifica | Limiar | Onde roda |
|---|---|---|---|---|
| FA01 | DA02 | UPDATE/DELETE na tabela de auditoria com a credencial da aplicação | 100% rejeitados | CI (veto) |
| FA02 | DA02 | Cadeia de hash do banco de auditoria (depende de BKL-004) | Zero quebras | Produção, diário |
| FA03 | DA02 | Alterações de nota com autor, motivo e valor anterior | 100% | Produção, contínuo |
| FA04 | DA04 | Suíte adversarial (rede, fork bomb, laço infinito, escrita na raiz…) | 100% bloqueadas em ≤ 30 s | CI (veto) |
| FA05 | DA04 | Configuração do container (não-root, sem rede, raiz só leitura, cgroups) | Todas verdadeiras | Deploy (veto) |
| FA06 | DA01 | Aluno A tenta ler resultado de B | 100% negadas | CI (veto) |
| FA07 | DA05 | Carga do pico: 1.440 submissões em 10 min | p95 no SLA; zero recusas | Semanal |
| FA08 | DA07 | Correção fora por 20 min sob carga | Zero perdas ou duplicatas | Mensal |
| FA09 | DA08 | Contrato Middleware–LMS | Zero quebras | CI (veto) |
| FA10 | DA06 | Ganho de vazão ao dobrar consumidores | ≥ 1,8× | Por release |
| FA11 | DA02 | Reexecução de submissões antigas com a versão registrada | 100% notas idênticas | Mensal |
| FA12 | DA09 | Artefatos além do prazo de retenção | Zero | Produção, diário |
| FA13 | DA03 | Reconstrução do histórico de uma nota | Sem lacunas em ≤ 5 min | Mensal |
| FA14 | DA10 | Serviço novo referenciando o LMS direto | Zero | CI (veto) |
| **FA15** | DA10, DA03 | **Regras 1 e 2 desta seção (ArchUnitTS)** | Zero violações | CI (veto) |
| **FA16** | DA10 | **Métricas Ca, Ce, I, A, D e ciclos (8.2)** | D = 0; > 0,10 reprova | CI (veto) |
| FA17 | DA09 | Nenhum serviço lê esquema de outro | Zero credenciais cruzadas | Deploy (veto) |
| FA19 | DA08, DA10 | Vocabulário do mainframe fora dos adaptadores | Zero ocorrências | CI (veto) |
| FA20 | DA10 | Compatibilidade dos esquemas de Contratos | Zero quebras | CI (veto) |
| FA21 | DA01, DA07 | Borda do gateway (413, mTLS, 429) | Todos os casos | Por release |
| FA22 | DA02, DA08 | LMS fora por 30 min; reprocessar a DLQ | Zero notas perdidas ou duplicadas | Agendada |
| FA23 | DA05, DA07 | Caos de IA no pico (Tier 2 e Tier 1 fora) | Correção mantém o SLA | Agendada |
| FA24 | DA08 | Nenhuma chamada ao LMS com circuito aberto | Zero chamadas | CI |
| FA25 | DA09 | PII no payload enviado ao modelo | Zero ocorrências | CI (veto) |
| FA26 | DA02 | Contrato do parecer de IA (JSON Schema, injeção) | 100% inválidas rejeitadas | CI (veto) |
| FA27 | DA02 | Concordância parecer × professor (conjunto-ouro) | Não cair do limiar | Ao trocar modelo/prompt |
| FA28 | DA10 | Domínio sem SDK de provedor de IA (parte da regra 1b) | Zero violações | CI (veto) |

*FA18 foi definida no documento de Comunicação entre Serviços (Sprint 3, 26/10).*

---

## Arquivos e referências

| Item | Onde |
|---|---|
| Catálogo original FA01–FA14 | `QAW/Sprint1_APS_KodeTech.pdf`, seção 4 |
| FA15–FA17 e métricas | Sprint 2, seções 5 e 6 |
| FA19–FA22 | Sprint 3, seção 5 |
| FA23–FA28 | ADRs 001, 003, 005 e 006; `docs/06-resiliencia-integracao-ia-native` |
