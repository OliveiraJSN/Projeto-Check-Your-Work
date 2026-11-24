import { CasoDeTeste, IRepositorioDeCasosDeTeste } from '../../dominio/correcao/portas';

export class PostgresCasosDeTesteAdapter implements IRepositorioDeCasosDeTeste {
  async buscarPorEnunciado(_enunciadoId: string): Promise<CasoDeTeste[]> {
    return []; // SELECT ... FROM correcao.casos_de_teste WHERE enunciado_id = $1
  }
}
