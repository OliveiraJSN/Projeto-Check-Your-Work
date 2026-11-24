import { IPublicadorDeEventos, IRepositorioDeAuditoria, NotaCalculada, SubmissaoRecebida } from '../contratos';
import { IPoliticaDeAvaliacao, IRepositorioDeCasosDeTeste, ISandboxDeExecucao } from './portas';

export class ServicoDeCorrecao {
  constructor(private readonly sandbox: ISandboxDeExecucao,
              private readonly casos: IRepositorioDeCasosDeTeste,
              private readonly politica: IPoliticaDeAvaliacao,
              private readonly fila: IPublicadorDeEventos,
              private readonly auditoria: IRepositorioDeAuditoria) {}

  async corrigir(s: SubmissaoRecebida): Promise<NotaCalculada> {
    const casos = await this.casos.buscarPorEnunciado(s.enunciadoId);
    const r = await this.sandbox.executar(s.codigoFonte, s.linguagem, casos);
    const nota: NotaCalculada = {
      submissaoId: s.submissaoId, alunoId: s.alunoId, disciplinaId: s.disciplinaId,
      nota: this.politica.calcular(r),
      casosAprovados: r.casos.filter(c => c.aprovado).length, casosTotais: r.casos.length,
      versaoDoCorretor: `${this.politica.versao}@${r.digestDaImagem}`,
      explicacao: r.casos.map(c => `${c.casoId}: ${c.aprovado ? 'passou' : 'falhou'}`),
      calculadaEm: new Date().toISOString(),
    };
    await this.auditoria.registrar({ tipo: 'NOTA_CALCULADA', submissaoId: s.submissaoId,
      autor: 'corretor', dados: { ...nota }, ocorridoEm: nota.calculadaEm });
    await this.fila.publicar('resultados', nota);
    return nota;
  }
}
