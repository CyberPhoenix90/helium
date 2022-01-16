import { ConstDeclaration } from '../../../parsing/ast/ast';
import { ParsedFile } from '../../emitter';
import { emitExpression, emitTypeExpression } from './emit_expression';
import { emitExported } from './emit_message';

export function emitConstDeclaration(ast: ConstDeclaration, dts: boolean, resolveImport: (src: string, path: string) => ParsedFile): string {
    return `	${emitExported(ast, dts)}${dts ? 'const ' : ''}${ast.identifier.value}${dts ? `: ${emitTypeExpression(ast.type)}` : ''}${
        dts ? '' : ` = ${emitExpression(ast.value, resolveImport)};`
    }`;
}
