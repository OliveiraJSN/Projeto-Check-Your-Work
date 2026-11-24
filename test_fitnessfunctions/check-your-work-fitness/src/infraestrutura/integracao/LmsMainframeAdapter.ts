import { ILmsGateway, IndiceParaLms, NotaParaLms } from '../../dominio/integracao/portas';

// O formato do mainframe (registro posicional/copybook) existe SÓ aqui (ADR 001)
export class LmsMainframeAdapter implements ILmsGateway {
  async enviarNota(n: NotaParaLms): Promise<void> {
    await this.transmitir(`NT${n.alunoId.padEnd(12)}${n.disciplinaId.padEnd(8)}${n.nota.toFixed(2).padStart(5, '0')}`);
  }
  async enviarIndice(i: IndiceParaLms): Promise<void> {
    await this.transmitir(`PL${i.alunoId.padEnd(12)}${i.disciplinaId.padEnd(8)}${i.classificacao}`);
  }
  private async transmitir(_registro: string): Promise<void> { /* timeout, retry e circuit breaker */ }
}
