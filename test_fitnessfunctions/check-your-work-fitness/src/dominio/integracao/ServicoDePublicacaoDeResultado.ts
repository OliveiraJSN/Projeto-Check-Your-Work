import { IRepositorioDeAuditoria, NotaCalculada } from '../contratos';
import { ILmsGateway } from './portas';

export class ServicoDePublicacaoDeResultado {
  constructor(private readonly lms: ILmsGateway,
              private readonly auditoria: IRepositorioDeAuditoria) {}

  async publicarNota(n: NotaCalculada): Promise<void> {
    await this.lms.enviarNota({ alunoId: n.alunoId, disciplinaId: n.disciplinaId, nota: n.nota });
    await this.auditoria.registrar({ tipo: 'NOTA_ENVIADA_AO_LMS', submissaoId: n.submissaoId,
      autor: 'middleware', dados: { nota: n.nota, versao: n.versaoDoCorretor }, ocorridoEm: new Date().toISOString() });
  }
}
