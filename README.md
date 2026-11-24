# Checklist de Code Review & Governança Arquitetural (GitHub PR Template)

> **Instruções para os Alunos:** Copie todo o conteúdo deste arquivo e salve em `.github/PULL_REQUEST_TEMPLATE.md` na raiz do repositório da sua equipe no GitHub. Assim, toda vez que alguém abrir um Pull Request (PR), este checklist aparecerá automaticamente para ser preenchido e verificado pelos pares e pelo líder da equipe antes do *merge*.

---

## Descrição da Alteração
<!-- Descreva de forma sucinta o que este PR introduz, altera ou refatora no projeto. -->

- **Tipo de Mudança:**
  - [  ] `feat` (Nova funcionalidade de negócio)
  - [  ] `arch` (Decisão de arquitetura / alteração de estrutura / ADR)
  - [  ] `refactor` (Refatoração para aplicação de SOLID / GoF)
  - [  ] `fix` (Correção de erro ou falha de integração)
  - [  ] `docs` (Atualização de diagramas C4 ou documentação)

- **Projeto da Equipe:** <!-- Ex: Check Your Work / Going... Gone! / Gird the Grid / etc. -->

---

- **ADR(s) Relacionada(s):** <!-- Ex: ADR-003, ADR-005 -->

---

## 1. Design & Princípios de Arquitetura (SOLID, GoF e DDD)

- [  ] **Inversão de Dependência (DIP):** As classes da camada de Domínio dependem estritamente de abstrações (interfaces), sem acoplamento a frameworks, ORMs ou bancos de dados?
- [  ] **Princípio Aberto/Fechado (OCP):** Novas funcionalidades foram introduzidas estendendo o comportamento através de polimorfismo/interfaces, sem modificar o código de produção estável?
- [  ] **Padrões GoF Aplicados:** Os padrões de projeto GoF empregados (*Factory Method*, *Adapter*, *Strategy*, *State*, etc.) estão documentados e evitam sobre-engenharia?
- [  ] **Linguagem Ubíqua (DDD):** Os nomes de entidades, Objeto de Valor (*Value Objects*), métodos e variáveis utilizam o vocabulário estrito do glossário de negócio?
- [  ] **Contextos Delimitados (*Bounded Contexts*):** Não há vazamento de modelos ou tabelas entre diferentes subdomínios?
- [  ] **Camada Anti-Corrupção (ACL):** Chamadas a APIs externas, mainframes ou sistemas legados foram encapsuladas por adaptadores de borda que protegem o *Core Domain*?

---

## 2. Modelo C4 & Documentação Técnica

- [  ] **Diagramas C4 Atualizados:** Se a topologia de contêineres ou serviços mudou, os diagramas C4 no diretório `/docs/c4-model/` (Nível 1, Nível 2 ou Nível 3 em Mermaid.js/imagem) foram atualizados?
- [  ] **Registro de Decisão Arquitetural (ADR):** Se este PR introduz uma nova tecnologia, biblioteca, protocolo ou padrão de mensageria, a ADR correspondente foi criada na pasta `/adrs/` com a seção de **Consequências e Trade-offs** preenchida?
- [  ] **README Atualizado:** Os caminhos, links e tabelas de rastreabilidade de arquivos no `README.md` principal permanecem válidos?

---

## 3. Resiliência, Integração & Componentes IA-Native

- [  ] **Contratos de Interface:** As APIs expostas ou consumidas (REST/JSON ou gRPC/Protobuf) possuem contratos formais atualizados?
- [  ] **Tratamento de Falhas Parciais:** Chamadas remotas a serviços sujeitos a instabilidade possuem política de **Timeout**, **Retry com Backoff Exponencial** e **Circuit Breaker** (ex: Polly)?
- [  ] **Mensageria & Tolerância a Falhas:** As filas de integração (RabbitMQ/Kafka) contemplam tratamento de mensagens envenenadas (*Poison Pills*) e roteamento para *Dead Letter Queue* (DLQ)?
- [  ] **Componentes IA-Native:** Caso envolva chamadas a LLMs/SLMs, o prompt utiliza **Saídas Estruturadas (*Structured Outputs* com JSON Schema)** e possui validação de *Guardrails*?
- [  ] **Privacidade (PII):** Não há envio de dados pessoais identificáveis ou credenciais para modelos de IA de terceiros sem anonimização prévia?

---

## 4. Testes de Arquitetura & Qualidade de Código

- [  ] **Fitness Functions (ArchUnit):** Os testes automatizados de arquitetura foram executados (`dotnet test` / `mvn test`) e passaram sem violação de dependências de camadas?
- [  ] **Segurança & Credenciais:** O código foi verificado para garantir que **NENHUMA** chave de API, senha de banco de dados ou token privado foi commitado em *hardcode*?
- [  ] **Métricas de Código:** O código alterado não eleva o acoplamento efferente de forma injustificada, mantendo a estabilidade (\(I\)) do núcleo do sistema?

---

## 5. Validação da Banca & Parecer do Revisor (Peer Review)

- **Revisor 1 (Membro da Equipe):** ________________________ — Status: [  ] Aprovado
- **Revisor 2 (Líder da Equipe) :** ________________________ — Status: [  ] Aprovado

> **Observações do Revisor:**
> <!-- Espaço para feedbacks construtivos durante a revisão do Pull Request. -->

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