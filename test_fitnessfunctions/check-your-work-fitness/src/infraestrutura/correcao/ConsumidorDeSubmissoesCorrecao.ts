import { ServicoDeCorrecao } from '../../dominio/correcao/ServicoDeCorrecao';
import { SubmissaoRecebida } from '../../dominio/contratos';

export class ConsumidorDeSubmissoesCorrecao {
  constructor(private readonly servico: ServicoDeCorrecao) {}
  async aoReceber(msg: SubmissaoRecebida) { await this.servico.corrigir(msg); }
}
