import { EvidenciaPublicada, IPublicadorDeEventos, IRepositorioDeAuditoria, SubmissaoRecebida } from '../contratos';
import { IAcervoDeTrabalhos, IMotorDeComparacaoDeSimilaridade, IPoliticaDeClassificacao } from './portas';

export class ServicoDeDeteccaoDePlagio {
  constructor(private readonly motor: IMotorDeComparacaoDeSimilaridade,
              private readonly acervo: IAcervoDeTrabalhos,
              private readonly politica: IPoliticaDeClassificacao,
              private readonly fila: IPublicadorDeEventos,
              private readonly auditoria: IRepositorioDeAuditoria) {}

  async analisar(s: SubmissaoRecebida): Promise<EvidenciaPublicada> {
    const alvo = { idPseudonimo: s.submissaoId, enunciadoId: s.enunciadoId, codigoFonte: s.codigoFonte };
    const acervo = await this.acervo.listarPorEnunciado(s.enunciadoId);
    const resultados = await this.motor.comparar(alvo, acervo);
    const pior = resultados.sort((a, b) => b.indice - a.indice)[0];
    const indiceMaximo = pior?.indice ?? 0;
    const evidencia: EvidenciaPublicada = {
      submissaoId: s.submissaoId, alunoId: s.alunoId, disciplinaId: s.disciplinaId, indiceMaximo,
      classificacao: this.politica.classificar(indiceMaximo),
      submissaoComparadaId: pior?.comparadoCom ?? null,
      motorUtilizado: this.motor.nome, geradaEm: new Date().toISOString(),
    };
    await this.acervo.adicionar(alvo);
    await this.auditoria.registrar({ tipo: 'EVIDENCIA_GERADA', submissaoId: s.submissaoId,
      autor: 'detector', dados: { indiceMaximo }, ocorridoEm: evidencia.geradaEm });
    await this.fila.publicar('resultados', evidencia);
    return evidencia;
  }
}
