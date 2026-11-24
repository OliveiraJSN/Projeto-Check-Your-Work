import { IPublicadorDeEventos, IRepositorioDeAuditoria, SubmissaoRecebida } from '../contratos';

export class ServicoDeRecepcaoDeSubmissao {
  constructor(private readonly fila: IPublicadorDeEventos,
              private readonly auditoria: IRepositorioDeAuditoria) {}

  async receber(s: SubmissaoRecebida): Promise<string> {
    await this.auditoria.registrar({ tipo: 'SUBMISSAO_RECEBIDA', submissaoId: s.submissaoId,
      autor: s.alunoId, dados: {}, ocorridoEm: s.recebidaEm });
    await this.fila.publicar('submissoes', s);
    return s.submissaoId; // protocolo devolvido na hora; a nota vem depois
  }
}
