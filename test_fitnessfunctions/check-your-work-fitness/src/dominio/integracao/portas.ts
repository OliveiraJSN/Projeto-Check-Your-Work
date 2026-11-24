// Porta para o legado: fala a língua do DOMÍNIO, não a do mainframe (ADR 001)
export interface NotaParaLms { alunoId: string; disciplinaId: string; nota: number; }
export interface IndiceParaLms { alunoId: string; disciplinaId: string; classificacao: string; }
export interface ILmsGateway {
  enviarNota(n: NotaParaLms): Promise<void>;
  enviarIndice(i: IndiceParaLms): Promise<void>;
}
