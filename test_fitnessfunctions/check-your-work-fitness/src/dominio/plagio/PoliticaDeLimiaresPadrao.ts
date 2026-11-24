import { IPoliticaDeClassificacao } from './portas';

export class PoliticaDeLimiaresPadrao implements IPoliticaDeClassificacao {
  classificar(indice: number) {
    if (indice >= 0.8) return 'INDICIO_FORTE' as const;
    if (indice >= 0.5) return 'REVISAR' as const;
    return 'SEM_INDICIO' as const;
  }
}
