import { EvidenciaPublicada, IPublicadorDeEventos, NotaCalculada, SubmissaoRecebida } from '../../dominio/contratos';

export class RabbitMqPublicadorAdapter implements IPublicadorDeEventos {
  async publicar(_topico: 'submissoes' | 'resultados',
                 _evento: SubmissaoRecebida | NotaCalculada | EvidenciaPublicada): Promise<void> {
    /* channel.publish(...) com mensagem persistente */
  }
}
