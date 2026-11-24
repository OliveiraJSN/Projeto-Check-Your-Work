export interface Trabalho { idPseudonimo: string; enunciadoId: string; codigoFonte: string; }
export interface TrechoCoincidente { inicio: number; fim: number; }
export interface ResultadoBrutoComparacao { comparadoCom: string; indice: number; trechos: TrechoCoincidente[]; }
export interface IMotorDeComparacaoDeSimilaridade {
  readonly nome: string;
  comparar(alvo: Trabalho, acervo: Trabalho[]): Promise<ResultadoBrutoComparacao[]>;
}
export interface IAcervoDeTrabalhos {
  listarPorEnunciado(enunciadoId: string): Promise<Trabalho[]>; // escopo por enunciado (BOTE 3.4)
  adicionar(t: Trabalho): Promise<void>;
}
export interface IPoliticaDeClassificacao {
  classificar(indice: number): 'SEM_INDICIO' | 'REVISAR' | 'INDICIO_FORTE';
}
