# ADR-002 — Estratégia de Desacoplamento de Código com DIP e Padrões GoF

| Campo | Valor |
|---|---|
| **Status** | Proposto |
| **Data** | 2026-10-03 (rev. 2026-11-23) |
| **Decisores** | Grupo KodeTech |
| **Corresponde a** | ADR 009 rev. 2 (Sprint 2) + Relatório de Padrões de Projeto (19/10/2026) |
| **Substitui** | ADR 009 v1 e o rascunho do kata "Abstração do Motor de Comparação de Similaridade" (já incorporados na rev. 2) |
| **Relacionadas** | ADR-001, ADR-004, ADR-006 |
| **Drivers** | DA02, DA03, DA04, DA08, DA09, DA10; R01, R02, R03 |

## Contexto

A primeira versão da avaliação de estabilidade (ADR 009 v1) mediu quatro pacotes e os considerou aderentes, mas a auditoria da Sprint 2 mostrou que as regras mais sensíveis (política de nota, DA02, e classificação de similaridade, art. 20 da LGPD) conviviam com Docker, *winnowing* e o protocolo do mainframe em pacotes de alta instabilidade (I = 1), e que o núcleo importava o DTO do LMS, anulando a camada anticorrupção.

Na Sprint 4 entra um **componente probabilístico** (modelos de IA) com dependências externas (servidor de inferência, API de provedor, banco vetorial). Sem o mesmo cuidado, o SDK de um provedor acabaria dentro da regra de negócio, e trocar de modelo seria reescrever o domínio.

## Decisão

Organizar o código em **pacotes primários que definem as próprias portas** (interfaces) para tudo que é tecnologia, e mover toda implementação concreta para pacotes `*.Adaptadores`, que dependem das portas e **nunca o contrário** (Dependency Inversion Principle). A comunicação entre pacotes primários passa só pelo pacote `Contratos` (interfaces e mensagens, só mudanças aditivas).

| Pacote primário | Portas que define | Adaptadores (concretos) |
|---|---|---|
| Correção | `ISandboxDeExecucao`, `IRepositorioDeCasosDeTeste`, `IPoliticaDeAvaliacao` | Docker/gVisor |
| Plágio | `IMotorDeComparacaoDeSimilaridade`, `IAcervoDeTrabalhos`, `IPoliticaDeClassificacao` | Winnowing; TurnItIn (fora do build) |
| Integração | `ILmsGateway` (recebe tipos do domínio: `NotaParaLms`, `IndiceParaLms`) | `LmsMainframeAdapter` |
| Auditoria | `IRepositorioDeAuditoria` (só `registrar()`: o append-only está no contrato) | PostgreSQL |
| **Análise Semântica (novo)** | **`IAvaliadorSemantico`, `IRecuperadorDeContexto`, `ISanitizadorDePII`, `IEstrategiaDeTier`** | **Adaptador do SLM local, adaptador do LLM em nuvem, pgvector** |

### Catálogo de padrões GoF adotados

| Padrão | Categoria | Onde | Problema que resolve |
|---|---|---|---|
| **Adapter** | Estrutural | `LmsMainframeAdapter`, adaptadores de modelo (SLM/LLM), adaptador do sandbox | Traduz XML/copybook do legado e as APIs de cada provedor de IA para os tipos do domínio, sem vazar para o núcleo (ACL) |
| **Factory Method** | Criacional | `FabricaDeAvaliadorSemantico`, `FabricaDeMotorDeSimilaridade` | Instancia o conector certo (SLM, LLM, TurnItIn, winnowing) a partir de configuração, sem o domínio conhecer classes concretas |
| **Strategy** | Comportamental | `IPoliticaDeAvaliacao` (`PoliticaPorPesos`...), `IEstrategiaDeTier` (escolha SLM × LLM), `IPoliticaDeClassificacao` | Elimina `if/else` de regras de negócio e permite trocar algoritmo sem alterar a classe mestra (OCP) |
| **Command** (+ Memento proposto) | Comportamental | `EnviarNotaCmd` no reprocessamento; revisão de nota | Reprocessar a entrega ao LMS com os mesmos dados, de forma idempotente |
| **Decorator** *(opcional)* | Estrutural | `AvaliadorSemanticoComCache`, `...ComCircuitBreaker` | Soma cache e resiliência ao avaliador sem alterar sua implementação |

### Princípios SOLID aplicados

- **DIP:** o domínio declara as interfaces; a infraestrutura as implementa.
- **OCP:** novo modelo de IA ou nova política de nota = nova classe + registro na fábrica, sem editar as classes mestras.
- **SRP:** um ator por pacote primário (Integração, Correção, Plágio, Análise Semântica).
- **LSP / ISP:** portas pequenas e específicas (ex.: `IRepositorioDeAuditoria` só tem `registrar()`); qualquer adaptador de modelo pode substituir outro.

## Alternativas rejeitadas

| Alternativa | Por que foi rejeitada |
|---|---|
| Manter a ADR 009 v1 e só corrigir os números | Corrigir a planilha não corrige a estrutura; a regra de nota continuaria acoplada ao Docker |
| Separar cada pacote em "API" (A = 1) e "implementação" (A = 0) | Dobra o número de pacotes e esconde regra de negócio num pacote 100% concreto e instável |
| Chamar o SDK de um provedor de IA direto no serviço de correção | Prende a regra de nota ao fornecedor, exige chave e rede em todo teste unitário e impede o isolamento de privacidade |
| Biblioteca compartilhada com classes concretas de domínio entre serviços | Cai na Zona de Dor (A ≈ 0,33, I = 0) e acopla a implantação dos serviços |
| Framework de orquestração de IA (ex.: cadeias prontas) dentro do domínio | Traz dependência pesada ao núcleo; só é aceitável dentro de um adaptador |

## Consequências

**Positivas**
- Regras críticas (nota, limiares de plágio, escolha de tier) são testáveis com dublês, sem rede, banco, sandbox ou modelo.
- Trocar de modelo, de provedor, de sandbox ou de motor de similaridade vira **troca de adaptador**.
- A camada anticorrupção funciona: nenhum tipo do LMS nem do provedor de IA chega ao domínio.

**Negativas**
- Mais tipos e uma indireção por porta; exige disciplina para não "atalhar" importando um adaptador.
- `D = 0` é um ponto, não um estado permanente: cada variação (ex.: plugar o TurnItIn) precisa ser explicada.
- `Contratos` é compartilhado: mudança incompatível exige coordenação de implantação (mitigação: só campos novos opcionais, FA20).

## Governança (funções de aptidão)

| ID | Verifica | Limiar |
|---|---|---|
| FA15 | Teste arquitetural: pacotes primários não importam `*.Adaptadores`, SDK de Docker/pg/amqplib/HTTP **nem SDK de provedor de IA**, nem outro pacote primário | Zero violações; reprova o build |
| FA16 | CI calcula Ca, Ce, I, A e D por pacote e detecta ciclos | Primários: D = 0 como meta; D > 0,10 ou ciclo reprova |
| FA28 (nova) | Domínio não importa o adaptador do modelo de IA | Zero violações |
| Métrica complementar | % dos testes de Correção e Plágio que rodam sem rede/sandbox | 100% |
