import { ServicoDeDeteccaoDePlagio } from '../../dominio/plagio/ServicoDeDeteccaoDePlagio';
import { SubmissaoRecebida } from '../../dominio/contratos';

export class ConsumidorDeSubmissoesPlagio {
  constructor(private readonly servico: ServicoDeDeteccaoDePlagio) {}
  async aoReceber(msg: SubmissaoRecebida) { await this.servico.analisar(msg); }
}
