# ADR-005 — Seleção de Frameworks, Banco Vetorial e Stack do API Gateway

| Campo | Valor |
|---|---|
| **Status** | Proposto |
| **Data** | 2026-11-23 |
| **Decisores** | Grupo KodeTech |
| **Corresponde a** | ADR 012 da Sprint 3 ("ADR 005 — Decisão de Frameworks e Padrões de Integração" do roteiro do Encontro 13), **estendida com banco vetorial, resiliência e inferência** |
| **Relacionadas** | ADR-001, ADR-003, ADR-006; BKL-005 (autenticação entre serviços, aberta) |
| **Drivers** | DA01, DA02, DA05, DA07, DA08, DA09; R01 |

## Contexto

O sistema tem um único chamador externo (o LMS), quatro serviços de código próprio e volume pequeno e sazonal (~7 req/s no pico instantâneo). A pilha de código da equipe é **TypeScript/Node** desde as Sprints 2 e 3. A Sprint 4 acrescenta três necessidades: um **banco vetorial** para o RAG, uma **biblioteca de resiliência** (o enunciado cita Polly, que é .NET) e **onde rodar o modelo**.

## Decisão

| Camada | Escolha | Motivo resumido |
|---|---|---|
| **API Gateway** | **NGINX** (só infraestrutura: TLS, mTLS com o LMS, limite de 256 KiB, rate limit, roteamento; 2 instâncias) | Conhecido pela equipe e pela TI; configuração versionada; sem regra de negócio no proxy |
| **Integração com o legado** | **EIPs code-first em TypeScript** dentro do serviço Integração (Router, Idempotent Receiver, Translator, Wire Tap, Dead Letter Channel) | Tipados, testáveis em teste unitário, no mesmo repositório |
| **Mensageria** | **RabbitMQ** com filas *quorum* e dead-letter exchange | Padrão de roteamento rico para fanout + retry + DLQ; volume baixo |
| **Resiliência** | **cockatiel** (retry, circuit breaker, timeout, bulkhead, fallback) | Equivalente em TypeScript ao Polly do enunciado; composição de políticas; sem novo runtime |
| **Banco vetorial** | **PostgreSQL + extensão pgvector** (esquema próprio `semantica`) | Ver comparação abaixo |
| **Servidor de inferência (SLM local)** | **Servidor de inferência auto-hospedado com API HTTP** (ex.: Ollama ou vLLM; escolha final depende do hardware) atrás da porta `IAvaliadorSemantico` | Dados não saem da universidade; troca de servidor é troca de adaptador |
| **LLM em nuvem (Tier 2)** | **Provedor externo via adaptador**, desligado por *feature flag* até a análise LGPD | Ver ADR-006 |
| **Validação de contrato de IA** | **JSON Schema** (biblioteca Ajv) | Esquema único para validação e documentação |
| **Teste arquitetural** | Manter **dependency-cruiser** (FA15); avaliar ArchUnit para TypeScript (`archunit`) para as regras do tópico 8 | Já em uso; decisão de troca pertence ao tópico de fitness functions |
| **Não adotados agora** | Service mesh, ESB, Camel/MassTransit, Kong, gateway gerenciado | Ver alternativas |

### Banco vetorial: comparação

| Critério | **pgvector (escolhido)** | Qdrant | Milvus | Pinecone | OpenSearch / Elasticsearch kNN | Chroma |
|---|---|---|---|---|---|---|
| Novo componente para operar | **Não** (extensão do PostgreSQL já usado) | Sim | Sim (vários) | Não (SaaS) | Sim | Sim (embutido) |
| Dados fora da universidade | **Não** | Não (auto-hospedado) | Não | **Sim**, e envolve dado pessoal (LGPD, arts. 33–36) | Não | Não |
| Escala necessária (milhares de vetores/semestre) | **Sobra** | Sobra | Superdimensionado | Sobra | Superdimensionado | Sobra |
| Filtro por `enunciadoId` + isolamento de esquema/credencial (FA17) | **Nativo (SQL, esquema, grants)** | Por payload/coleção | Por partição | Por namespace | Por índice | Por coleção |
| Transação com o restante do dado do serviço | **Sim** | Não | Não | Não | Não | Não |
| Maturidade operacional (backup, auditoria) | **Alta** | Média | Média | Alta | Alta | Baixa |
| Teto de desempenho em milhões de vetores | Médio | Alto | Muito alto | Alto | Alto | Baixo |

Condição de reversão: se o corpus de exemplos crescer para dezenas de milhões de vetores ou a latência de busca violar o SLA, migrar para Qdrant atrás da mesma porta `IRecuperadorDeContexto`.

## Alternativas avaliadas (demais camadas)

| Camada | Alternativa | Avaliação |
|---|---|---|
| Gateway | Kong | Plugins prontos, mas exige plano de administração e banco próprios; o valor aparece com muitos consumidores, e aqui há um |
| Gateway | AWS API Gateway / gerenciado | Prende a solução a um provedor e leva dados pessoais para fora sem análise prévia |
| Gateway | YARP / Spring Cloud Gateway | Bons, mas trazem .NET ou JVM para uma equipe em TypeScript |
| Integração | ESB centralizado | Tende a acumular regra de negócio no barramento |
| Integração | Apache Camel / MassTransit | Catálogo maduro de EIPs, mas exige runtime JVM/.NET só para cinco padrões simples |
| Mensageria | Apache Kafka | Para volume massivo e *replay*; desproporcional a ~7 req/s e mais caro de operar |
| Resiliência | **Polly** | **Não se aplica**: é .NET; trocar de linguagem só por isso não se justifica |
| Resiliência | opossum | Só circuit breaker; cockatiel cobre também retry, timeout e bulkhead com uma API |
| Malha | Service mesh (Istio, Linkerd) | Complexidade operacional desproporcional para 4 serviços; a autenticação interna é tratada no BKL-005 |
| Inferência | Somente API de nuvem | Todo dado de aluno sairia da universidade; custo imprevisível; viola a postura de privacidade (DA09) |

## Consequências

**Positivas**
- Nenhuma tecnologia nova de dados: o banco vetorial é o PostgreSQL que a equipe já opera, o que diminui custo e superfície de ataque.
- A stack inteira é TypeScript, exceto o servidor de inferência, que é produto de prateleira.
- Cada escolha de IA está atrás de uma porta (ADR-002), então todas são reversíveis.

**Negativas**
- pgvector tem teto de desempenho menor que bancos vetoriais dedicados em escala muito grande.
- O servidor de inferência exige hardware (GPU ou CPU potente): decisão de infraestrutura com a TI.
- Sem service mesh, a autenticação entre serviços depende de decisão futura (BKL-005); ficou mais urgente.
- cockatiel é biblioteca menos difundida que Polly; a equipe precisa conhecer suas políticas e a ordem de composição.

## Governança

| ID | Verifica | Limiar |
|---|---|---|
| FA21 | Testes de borda no gateway (413, mTLS, 429, pico sem recusas) | Todos passam por release |
| FA17 | Nenhum serviço lê o esquema `semantica` além do serviço dono | Zero credenciais cruzadas |
| FA24 (nova) | Circuit breaker: zero chamadas ao LMS com circuito aberto | Zero chamadas |
| Benchmark de busca vetorial (novo) | Latência p95 da consulta RAG sobre o corpus de um semestre | A definir na ADR-006 após o benchmark; violação dispara a condição de reversão |
