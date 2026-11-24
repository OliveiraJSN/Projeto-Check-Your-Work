import { IMotorDeComparacaoDeSimilaridade, ResultadoBrutoComparacao, Trabalho } from '../../dominio/plagio/portas';

export class WinnowingFingerprintAdapter implements IMotorDeComparacaoDeSimilaridade {
  readonly nome = 'winnowing-k5-w4';
  async comparar(_alvo: Trabalho, acervo: Trabalho[]): Promise<ResultadoBrutoComparacao[]> {
    return acervo.map(t => ({ comparadoCom: t.idPseudonimo, indice: 0, trechos: [] }));
  }
}
