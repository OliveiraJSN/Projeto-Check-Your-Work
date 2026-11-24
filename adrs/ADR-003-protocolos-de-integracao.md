# ADR-003 — Definição dos Protocolos de Integração (gRPC, REST e RabbitMQ)

| Campo | Valor |
|---|---|
| **Status** | Proposto |
| **Data** | 2026-11-23 |
| **Decisores** | Grupo KodeTech |
| **Origem** | Consolida decisões que estavam espalhadas na ADR 003 (fila), ADR 010 (idempotência) e ADR 012 (gateway); **gRPC é avaliado pela primeira vez aqui** |
| **Relacionadas** | ADR-001, ADR-004, ADR-005, ADR-006 |
| **Drivers** | DA01, DA02, DA05, DA07, DA08, DA10; R01, R04 |

## Contexto

O sistema tem quatro tipos de fronteira, cada um com uma restrição diferente:

| # | Fronteira | Restrição dominante |
|---|---|---|
| 1 | LMS → sistema (entrada) e sistema → LMS (saída) | LMS imodificável (R01); fala HTTPS com XML/copybook; não pode ser sobrecarregado (DA08) |
| 2 | Entre os serviços internos | Picos de 160× (DA05); aceitar não pode depender de corrigir (DA07); entrega ao menos uma vez |
| 3 | Serviço de Análise Semântica → servidor de inferência (SLM local) e → API do LLM em nuvem | Chamada síncrona de segundos, com *timeout* e circuit breaker; APIs de modelos já são HTTP |
| 4 | Serviços → Banco de Auditoria e bancos próprios | Só INSERT; esquema por serviço (FA17) |

A pergunta do enunciado é qual protocolo usar em cada uma. A ADR-001 já proíbe chamada síncrona entre serviços internos.

## Decisão

| Fronteira | Protocolo | Detalhe |
|---|---|---|
| 1. LMS ⇄ sistema | **REST/HTTPS com payload XML legado** (entrada) e HTTP POST com registro XML/copybook (saída) | Entrada passa pelo gateway NGINX com TLS 1.2+ e **mTLS** (só o certificado do LMS é aceito); limite de 256 KiB; *rate limit* de 30 req/s com rajada de 60. A tradução para o domínio acontece na ACL (ADR-004) |
| 2. Entre serviços | **AMQP 0-9-1 com RabbitMQ**: exchange *fanout* `cyw.submissoes` (comandos/eventos de entrada), tópico `resultados` (retorno) e *dead-letter exchange* | Filas *quorum*, mensagens persistentes, *publisher confirms*, ack manual, retry exponencial por filas com TTL, DLQ final; idempotência por `(type, submissaoId)` |
| 3. Análise Semântica ⇄ modelos | **HTTP/JSON (REST)** para o servidor de inferência local (API compatível com a de chat dos provedores) e para o LLM em nuvem | Tudo atrás da porta `IAvaliadorSemantico`; timeout, retry, circuit breaker e bulkhead no adaptador |
| 4. Persistência | **SQL (PostgreSQL)** | Banco por serviço; auditoria só com INSERT |
| Contratos de mensagem | **JSON com esquema versionado** (pacote `Contratos`, *Published Language*) | Só campos novos opcionais; teste de compatibilidade (FA20) |

**gRPC: não adotado agora.** Fica registrado como opção para um futuro caso de chamada síncrona de baixa latência entre serviços (por exemplo, *streaming* de tokens do modelo para a tela do professor). Hoje não há esse caso.

## Alternativas avaliadas

| Alternativa | Avaliação |
|---|---|
| **gRPC entre serviços internos** | Contrato tipado e eficiente, mas implica chamada síncrona entre serviços, o que a ADR-001 proíbe; acopla disponibilidade (se a Correção cai, a Integração para) e perde o amortecimento da fila no pico. Descartado |
| **gRPC para falar com o modelo** | Os servidores de inferência e os provedores expõem HTTP/JSON como interface padrão; usar gRPC exigiria adaptação sem ganho mensurável para chamadas de segundos |
| **REST síncrono entre serviços** | Mesmo problema do gRPC (acoplamento temporal) e pior no pico |
| **Kafka em vez de RabbitMQ** | Excelente para volume massivo e *replay*, mas o volume aqui é pequeno (~7 req/s) e o ganho não compensa a operação (detalhado na ADR-005) |
| **SOAP/EDI para o LMS** | O LMS é o que dita o formato; a ACL absorve o XML/copybook, não há o que escolher |
| **Banco de dados compartilhado como integração** | Proibido pela FA17 e pela ADR-001 |

## Consequências

**Positivas**
- Cada protocolo é o mais simples que atende à restrição da sua fronteira.
- O amortecimento do pico acontece na fila; o legado só vê tráfego controlado.
- Trocar de provedor de IA não muda o protocolo (HTTP/JSON atrás de uma porta).

**Negativas**
- Dois mundos de contrato (XML legado e JSON interno) exigem tradução na ACL; cada homônimo é um mapeamento a manter.
- Consistência eventual: o chamador recebe protocolo agora e nota depois.
- Sem gRPC, uma futura necessidade de *streaming* síncrono exigirá nova decisão.

## Governança

| ID | Verifica | Limiar |
|---|---|---|
| FA20 | Compatibilidade dos esquemas de `Contratos` entre versão atual e anterior | Zero quebras |
| FA21 | Testes de borda no gateway (413, mTLS, 429, pico sem recusas) | Todos passam por release |
| FA24 (nova) | Com o LMS simulado fora, nenhuma chamada ao legado com circuito aberto | Zero chamadas |
| FA14 | Nenhum serviço novo referencia o LMS diretamente | Zero dependências |
