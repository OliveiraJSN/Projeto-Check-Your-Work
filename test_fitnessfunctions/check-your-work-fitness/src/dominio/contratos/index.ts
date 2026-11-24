// CheckYourWork.Contratos — linguagem publicada (A = 1): só contratos, nenhuma implementação
export interface SubmissaoRecebida {
  submissaoId: string; alunoId: string; disciplinaId: string;
  enunciadoId: string; linguagem: string; codigoFonte: string; recebidaEm: string;
}
export interface NotaCalculada {
  submissaoId: string; alunoId: string; disciplinaId: string; nota: number;
  casosAprovados: number; casosTotais: number;
  versaoDoCorretor: string; // política + digest da imagem do sandbox (FA11)
  explicacao: string[];     // LGPD art. 20
  calculadaEm: string;
}
export interface EvidenciaPublicada {
  submissaoId: string; alunoId: string; disciplinaId: string; indiceMaximo: number;
  classificacao: 'SEM_INDICIO' | 'REVISAR' | 'INDICIO_FORTE'; // evidência, nunca veredito
  submissaoComparadaId: string | null; motorUtilizado: string; geradaEm: string;
}
export interface EventoDeAuditoria {
  tipo: string; submissaoId: string; autor: string;
  dados: Record<string, unknown>; ocorridoEm: string;
}
export interface IPublicadorDeEventos {
  publicar(topico: 'submissoes' | 'resultados',
           evento: SubmissaoRecebida | NotaCalculada | EvidenciaPublicada): Promise<void>;
}
export interface IRepositorioDeAuditoria {
  registrar(evento: EventoDeAuditoria): Promise<void>; // append-only: não existe update nem delete
}
