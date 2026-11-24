import { ServicoDePublicacaoDeResultado } from '../../dominio/integracao/ServicoDePublicacaoDeResultado';
import { NotaCalculada } from '../../dominio/contratos';

export class ConsumidorDeResultados {
  constructor(private readonly servico: ServicoDePublicacaoDeResultado) {}
  async aoReceber(msg: NotaCalculada) { await this.servico.publicarNota(msg); }
}
