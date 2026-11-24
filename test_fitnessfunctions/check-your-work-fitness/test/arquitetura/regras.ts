import * as ts from 'typescript';
import type { FileInfo } from 'archunit';

/** Bibliotecas de tecnologia que só podem aparecer na Infraestrutura (FA15). */
export const BIBLIOTECAS_DE_INFRA = ['pg', 'amqplib', 'dockerode', 'axios', 'node:http', 'node:child_process'];

function importsDe(file: FileInfo): ts.ImportDeclaration[] {
  const sf = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true);
  return sf.statements.filter(ts.isImportDeclaration);
}

/** Regra 1b — o arquivo de domínio não importa biblioteca de infraestrutura. */
export const naoImportaBibliotecaDeInfra = (file: FileInfo): boolean =>
  importsDe(file).every(imp => {
    const modulo = (imp.moduleSpecifier as ts.StringLiteral).text;
    return !BIBLIOTECAS_DE_INFRA.some(lib => modulo === lib || modulo.startsWith(`${lib}/`));
  });

/**
 * Regra 2 — toda classe do arquivo de repositório declara `implements`
 * de uma interface abstrata importada da camada de Domínio.
 * Verifica a AST (não busca texto): a interface tem de vir de um import
 * cujo caminho passa por `dominio/`, e não de outro adaptador.
 */
export const implementaInterfaceDoDominio = (file: FileInfo): boolean => {
  const sf = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true);

  const interfacesDoDominio = new Set<string>();
  for (const imp of sf.statements.filter(ts.isImportDeclaration)) {
    const modulo = (imp.moduleSpecifier as ts.StringLiteral).text;
    const nomes = imp.importClause?.namedBindings;
    if (modulo.includes('dominio/') && nomes && ts.isNamedImports(nomes)) {
      nomes.elements.forEach(e => interfacesDoDominio.add(e.name.text));
    }
  }

  const classes = sf.statements.filter(ts.isClassDeclaration);
  if (classes.length === 0) return false;

  return classes.every(classe =>
    (classe.heritageClauses ?? [])
      .filter(h => h.token === ts.SyntaxKind.ImplementsKeyword)
      .flatMap(h => h.types)
      .some(t => ts.isIdentifier(t.expression) && interfacesDoDominio.has(t.expression.text)),
  );
};
