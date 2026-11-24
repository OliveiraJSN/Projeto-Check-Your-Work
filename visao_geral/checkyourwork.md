V# Check Your Work — Corretor Automático de Trabalhos de Programação

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
