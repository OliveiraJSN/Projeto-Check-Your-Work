import { ServicoDeRecepcaoDeSubmissao } from '../../dominio/integracao/ServicoDeRecepcaoDeSubmissao';
import { SubmissaoRecebida } from '../../dominio/contratos';

export class LmsWebhookController {
  constructor(private readonly servico: ServicoDeRecepcaoDeSubmissao) {}
  async post(body: SubmissaoRecebida) { return { protocolo: await this.servico.receber(body) }; }
}
