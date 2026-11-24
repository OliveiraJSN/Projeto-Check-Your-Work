import { IAcervoDeTrabalhos, Trabalho } from '../../dominio/plagio/portas';

export class PostgresAcervoAdapter implements IAcervoDeTrabalhos {
  async listarPorEnunciado(_enunciadoId: string): Promise<Trabalho[]> { return []; }
  async adicionar(_t: Trabalho): Promise<void> { /* INSERT em plagio.acervo (id pseudônimo) */ }
}
