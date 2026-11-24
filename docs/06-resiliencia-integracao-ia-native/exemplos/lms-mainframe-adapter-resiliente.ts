// CheckYourWork.Integracao.Adaptadores
// Adaptador do LMS (ACL) com resiliência: timeout, retry exponencial, circuit breaker e bulkhead.
// Equivalente em TypeScript ao que o enunciado descreve com Polly (.NET): biblioteca "cockatiel".
//
// ATENÇÃO: exemplo ilustrativo, escrito para o projeto e NÃO compilado/executado.
// Antes de entregar: `npm i cockatiel` e rodar `tsc --strict` junto com os tipos da Sprint 2.

import {
  BrokenCircuitError,
  ConsecutiveBreaker,
  ExponentialBackoff,
  TimeoutStrategy,
  bulkhead,
  circuitBreaker,
  handleAll,
  handleWhen,
  retry,
  timeout,
  wrap,
} from "cockatiel";

// Tipos e portas da Sprint 2/3 (declarados aqui só para o exemplo ser legível).
export interface NotaParaLms { alunoId: string; disciplinaId: string; nota: number; protocolo: string }
export interface IndiceParaLms { alunoId: string; disciplinaId: string; classificacao: string }
export interface ILmsGateway {
  enviarNota(n: NotaParaLms): Promise<void>;
  enviarIndice(i: IndiceParaLms): Promise<void>;
}
export interface IClienteHttp {
  post(caminho: string, corpo: string, timeoutMs: number, sinal?: AbortSignal): Promise<void>;
}

/** Sinaliza ao consumidor da fila que a entrega deve ir para retry/DLQ, e não ser descartada. */
export class EntregaAdiadaError extends Error {
  constructor(public readonly motivo: "CIRCUITO_ABERTO" | "BULKHEAD_CHEIO" | "FALHA_NO_LMS", causa?: unknown) {
    super(`Entrega ao LMS adiada: ${motivo}`);
    this.cause = causa;
  }
}

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class LmsMainframeAdapter implements ILmsGateway {
  // Ordem de composição (de fora para dentro): bulkhead -> retry -> circuit breaker -> timeout.
  // O retry NÃO repete quando o circuito já está aberto: senão amplificaria a carga sobre o legado.
  private readonly politica = wrap(
    bulkhead(10, 50), // no máximo 10 chamadas simultâneas ao mainframe, 50 na espera (R01, DA08)
    retry(handleWhen((e) => !(e instanceof BrokenCircuitError)), {
      maxAttempts: 3,
      backoff: new ExponentialBackoff({ initialDelay: 200, maxDelay: 5_000 }), // com jitter por padrão
    }),
    circuitBreaker(handleAll, {
      halfOpenAfter: 30_000,              // 30 s com o circuito aberto antes da chamada de prova
      breaker: new ConsecutiveBreaker(5), // abre após 5 falhas consecutivas
    }),
    timeout(5_000, TimeoutStrategy.Aggressive), // 5 s por chamada (Sprint 3)
  );

  constructor(private readonly http: IClienteHttp) {}

  async enviarNota(n: NotaParaLms): Promise<void> {
    // Message Translator: o layout do mainframe só existe dentro deste adaptador (FA19).
    const registro =
      `<LancamentoNota><PRONTI_COD>${xml(n.alunoId)}</PRONTI_COD>` +
      `<COD_DISC>${xml(n.disciplinaId)}</COD_DISC>` +
      `<VLR_NOTA>${n.nota.toFixed(1)}</VLR_NOTA>` +
      `<NR_PROTOC>${xml(n.protocolo)}</NR_PROTOC></LancamentoNota>`;
    await this.executar(registro);
  }

  async enviarIndice(i: IndiceParaLms): Promise<void> {
    const registro =
      `<LancamentoIndice><PRONTI_COD>${xml(i.alunoId)}</PRONTI_COD>` +
      `<COD_DISC>${xml(i.disciplinaId)}</COD_DISC>` +
      `<CLASSIF>${xml(i.classificacao)}</CLASSIF></LancamentoIndice>`;
    await this.executar(registro);
  }

  private async executar(registro: string): Promise<void> {
    try {
      await this.politica.execute(({ signal }) => this.http.post("/legacy/nota.cgi", registro, 5_000, signal));
    } catch (e) {
      // Fallback: nunca engolir a nota. Quem chama (consumidor da fila) faz nack sem requeue,
      // e a mensagem segue pelo dead-letter exchange: retry-5s -> retry-30s -> retry-5min -> DLQ.
      if (e instanceof BrokenCircuitError) throw new EntregaAdiadaError("CIRCUITO_ABERTO", e);
      if (e instanceof Error && e.name === "BulkheadRejectedError") throw new EntregaAdiadaError("BULKHEAD_CHEIO", e);
      throw new EntregaAdiadaError("FALHA_NO_LMS", e);
    }
  }
}
