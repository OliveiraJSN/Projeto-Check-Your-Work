export interface CasoDeTeste { id: string; entrada: string; saidaEsperada: string; peso: number; }
export interface ResultadoDeCaso { casoId: string; aprovado: boolean; peso: number; }
export interface ResultadoDeExecucao { casos: ResultadoDeCaso[]; digestDaImagem: string; }
export interface ISandboxDeExecucao {
  executar(codigoFonte: string, linguagem: string, casos: CasoDeTeste[]): Promise<ResultadoDeExecucao>;
}
export interface IRepositorioDeCasosDeTeste {
  buscarPorEnunciado(enunciadoId: string): Promise<CasoDeTeste[]>;
}
export interface IPoliticaDeAvaliacao {
  readonly versao: string;
  calcular(resultado: ResultadoDeExecucao): number;
}
