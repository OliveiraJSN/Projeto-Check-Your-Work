# ADR-004 — Mapeamento de Contextos Delimitados e Camada Anti-Corrupção

| Campo | Valor |
|---|---|
| **Status** | Proposto |
| **Data** | 2026-11-16 (rev. 2026-11-23 para incluir Análise Semântica) |
| **Decisores** | Grupo KodeTech |
| **Corresponde a** | ADR 011 da Sprint 3 ("ADR 004 — Delimitação dos Bounded Contexts" do roteiro do Encontro 9) |
| **Relacionadas** | ADR-001, ADR-002, ADR-003, ADR-006; BKL-006 (técnica de plágio) |
| **Drivers** | DA02, DA03, DA08, DA09, DA10; R01 |

## Contexto

Até a Sprint 2 as fronteiras foram desenhadas por critérios técnicos (quantum e métricas de estabilidade). Faltava verificar se também separam **significados de negócio**. Sem isso, o risco é um modelo canônico único: uma "Submissão" ou uma "Nota" tentando servir ao corretor, ao detector de plágio, ao mainframe e agora ao avaliador de IA.

Homônimos que mudam de significado ao cruzar fronteira: **Nota** (0 a 10 calculado × conceito alfanumérico do mainframe), **Aluno** (`alunoId` × Prontuário × anônimo para o modelo de IA), **Submissão** (a corrigir × trabalho do acervo × "entrega" para o LMS), **Resultado** (execução × evidência × lançamento).

## Decisão

Reconhecer **quatro Bounded Contexts internos** e tipificar cada relação do Mapa de Contexto.

| Contexto | Subdomínio | Linguagem própria |
|---|---|---|
| **Avaliação Automatizada** (inclui Análise Semântica) | **Core** | Submissão, Caso de Teste, Execução Isolada, Política de Avaliação, Nota Calculada, Versão do Corretor, Explicação, **Parecer Semântico** |
| Análise de Similaridade | Suporte | Acervo, Fingerprint, Evidência (nunca veredito) |
| Recepção e Integração | Suporte | Protocolo de aceite, Lançamento, NotaParaLms |
| Auditoria e Revisão | Suporte | Evento de Auditoria, Trilha, Revisão com motivo |

Contextos externos: **LMS Mainframe** (genérico), **motor externo de plágio** (se aprovado) e **provedor de IA em nuvem** (genérico, novo).

| Relação | Padrão do Mapa | Como é implementado |
|---|---|---|
| LMS → Recepção e Integração | **Upstream/Downstream com Anticorruption Layer** | `LmsMainframeAdapter` + tradutor de entrada; a porta `ILmsGateway` só recebe tipos do domínio |
| Identidade (LMS) → Integração | Conformista | Usamos o `alunoId` do LMS sem tradução |
| Integração → Avaliação e Similaridade | **Open Host Service + Published Language** | Evento `SubmissaoRecebida` no exchange `cyw.submissoes` |
| Avaliação e Similaridade → Integração | Published Language | `NotaCalculada`, `EvidenciaPublicada`, `ParecerSemanticoPublicado` no tópico `resultados` |
| Contratos (entre os serviços) | Published Language, **não Shared Kernel** | Pacote só com interfaces (A = 1), versionado, mudanças aditivas |
| Serviços → Auditoria e Revisão | Conformista | Todos gravam `EventoDeAuditoria` pela porta `IRepositorioDeAuditoria` (só INSERT) |
| Motor externo (TurnItIn) → Similaridade | Separate Ways hoje; ACL se aprovado | `TurnItInApiAdapter` fora do build até BKL-006 e análise LGPD |
| **Provedor de IA → Avaliação (novo)** | **Anticorruption Layer** | Porta `IAvaliadorSemantico`; o modelo é tratado como sistema **externo e não confiável**: sanitizador de PII na entrada, validador de saída (JSON Schema + ancoragem) e adaptador por provedor (ADR-006) |

Regras:
1. A Linguagem Ubíqua do Core é obrigatória em classes, métodos e testes.
2. Toda fronteira com sistema que não controlamos tem ACL. Não existe relação Conformista com o modelo do mainframe nem com o do provedor de IA; a única conformidade aceita com o LMS é a identidade (`alunoId`).
3. Entre contextos internos, a comunicação é Published Language pelo pacote `Contratos`, que não recebe classes de domínio.
4. A Análise Semântica pertence ao contexto Core (é a mesma pergunta de negócio: "qual a qualidade desta solução?") mesmo sendo um deployable separado pela ADR-001. **Contexto não é sinônimo de serviço.**

## Alternativas rejeitadas

| Alternativa | Por que foi rejeitada |
|---|---|
| Modelo canônico único (uma Submissão e uma Nota para todo o sistema) | Cada contexto precisa de campos diferentes; a classe única quebraria o SRP e acoplaria os deploys |
| Conformista com o LMS (usar Prontuário e conceito alfanumérico no núcleo) | Viola a R01; o vocabulário do mainframe ficaria no Core para sempre |
| Shared Kernel com classes de domínio entre serviços | Zona de Dor (A ≈ 0,33, I = 0) e deploys acoplados |
| Plágio como Core Domain | Desviaria esforço do que diferencia o sistema (a nota confiável) e travaria a decisão de comprar a técnica |
| Análise Semântica como contexto separado | Duplicaria a linguagem de "avaliação"; a IA é um **meio** de avaliar, não um subdomínio de negócio próprio |
| Auditoria e Revisão como quarto serviço agora | Não tem perfil de carga nem atributos diferentes; criaria um deploy sem ganho medido |

## Consequências

**Positivas:** fronteiras de negócio coincidem com as técnicas; a Linguagem Ubíqua passa a ser verificável; homônimos têm tradução em um lugar só; trocar de provedor de IA não toca o domínio.

**Negativas:** mais traduções a manter (cada homônimo é um mapeamento); o pacote `Contratos` exige versionamento e disciplina; Auditoria continua sem fronteira de deploy (a soberania de dados depende da FA17).

## Governança

| ID | Verifica | Limiar |
|---|---|---|
| FA15 | Pacotes primários não importam adaptadores nem outro pacote primário | Zero violações |
| FA17 | Nenhum serviço lê esquema de outro | Zero credenciais cruzadas |
| FA19 | Linguagem legada fora do núcleo: nenhum identificador do mainframe nem biblioteca de XML fora dos adaptadores | Zero ocorrências; reprova o build |
| FA20 | Published Language: consumidor da versão anterior lê mensagem da nova | Zero quebras |
| FA28 (nova) | Nenhum SDK/cliente de provedor de IA no domínio | Zero violações |
