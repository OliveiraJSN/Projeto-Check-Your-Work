import { IPoliticaDeAvaliacao, ResultadoDeExecucao } from './portas';

export class PoliticaPorPesos implements IPoliticaDeAvaliacao {
  readonly versao = 'pesos-1.0';
  calcular(r: ResultadoDeExecucao): number {
    const total = r.casos.reduce((s, c) => s + c.peso, 0);
    const obtido = r.casos.filter(c => c.aprovado).reduce((s, c) => s + c.peso, 0);
    return total === 0 ? 0 : Math.round((obtido / total) * 1000) / 100;
  }
}
