import { CasoDeTeste, ISandboxDeExecucao, ResultadoDeExecucao } from '../../dominio/correcao/portas';

// Container efêmero: cgroups, seccomp, --network none, rootfs somente leitura (ADR 002)
export class DockerGVisorSandboxAdapter implements ISandboxDeExecucao {
  constructor(private readonly imagem: string, private readonly digest: string) {}
  async executar(_codigo: string, _linguagem: string, casos: CasoDeTeste[]): Promise<ResultadoDeExecucao> {
    return { casos: casos.map(c => ({ casoId: c.id, aprovado: false, peso: c.peso })), digestDaImagem: this.digest };
  }
}
