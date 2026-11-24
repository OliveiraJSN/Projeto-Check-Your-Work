import { projectFiles } from 'archunit';
import { implementaInterfaceDoDominio, naoImportaBibliotecaDeInfra } from './regras';

/**
 * Fitness functions de arquitetura — Check Your Work (KodeTech)
 * Drivers: DA02, DA03, DA08, DA10 · ADR 001 · ADR 009 rev. 2 · FA15
 * Tipo: atômica · Cadência: a cada build (veto no merge)
 */
describe('FA15 — Governança de camadas (ArchUnitTS)', () => {

  describe('Regra 1 — Domínio não referencia Infraestrutura', () => {

    it('1a. nenhum arquivo de src/dominio importa arquivo de src/infraestrutura', async () => {
      const regra = projectFiles()
        .inFolder('src/dominio/**')
        .shouldNot()
        .dependOnFiles()
        .inFolder('src/infraestrutura/**');

      await expect(regra).toPassAsync();
    });

    it('1b. nenhum arquivo de src/dominio importa biblioteca de tecnologia (pg, amqplib, dockerode, HTTP...)', async () => {
      const regra = projectFiles()
        .inFolder('src/dominio/**')
        .should()
        .adhereTo(naoImportaBibliotecaDeInfra, 'Domínio não pode importar biblioteca de infraestrutura');

      await expect(regra).toPassAsync();
    });

    it('1c. os pacotes de domínio não formam ciclos de dependência (ADP)', async () => {
      const regra = projectFiles().inFolder('src/dominio/**').should().haveNoCycles();

      await expect(regra).toPassAsync();
    });
  });

  describe('Regra 2 — Repositórios implementam interface abstrata do Domínio', () => {

    it('2a. todo repositório (Postgres*Adapter) implementa uma porta declarada em src/dominio', async () => {
      const regra = projectFiles()
        .inFolder('src/infraestrutura/**')
        .withName(/^Postgres.*Adapter\.ts$/)
        .should()
        .adhereTo(implementaInterfaceDoDominio, 'Repositório deve implementar interface abstrata do Domínio');

      await expect(regra).toPassAsync();
    });

    it('2b. repositórios só existem na Infraestrutura (nenhum Postgres*Adapter dentro do Domínio)', async () => {
      const regra = projectFiles()
        .withName(/^Postgres.*Adapter\.ts$/)
        .should()
        .beInFolder('src/infraestrutura/**');

      await expect(regra).toPassAsync();
    });
  });
});
