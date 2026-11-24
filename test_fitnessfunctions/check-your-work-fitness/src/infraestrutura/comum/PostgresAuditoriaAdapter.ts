import { EventoDeAuditoria, IRepositorioDeAuditoria } from '../../dominio/contratos';

// Append-only: só INSERT; o usuário do banco não tem UPDATE/DELETE (ADR 004)
export class PostgresAuditoriaAdapter implements IRepositorioDeAuditoria {
  async registrar(_evento: EventoDeAuditoria): Promise<void> { /* INSERT INTO auditoria.eventos ... */ }
}
