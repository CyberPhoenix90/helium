import { ConstDeclaration, EnumDeclaration } from '../../../parsing/ast/ast';
import { emitExpression, emitLiteral, emitTypeExpression } from './emit_expression';
import { emitExported } from './emit_message';

export function emitEnum(ast: EnumDeclaration, dts: boolean): string {
    if (dts) {
        return `${emitExported(ast, dts)} enum ${ast.identifier.value} {
${ast.members.map((m) => `    ${m.identifier.value} = ${emitLiteral(m.value)}`).join(',\n')}
}\n`;
    } else {
        return `	exports.${ast.identifier.value} = {
${ast.members.map((m) => `	    ${m.identifier.value}: ${emitLiteral(m.value)}`).join(',\n')}
	}\n`;
    }
}

export function emitConstDeclaration(ast: ConstDeclaration, dts: boolean): string {
    return `	${emitExported(ast, dts)}${dts ? 'const ' : ''}${ast.identifier.value}${dts ? `: ${emitTypeExpression(ast.type)}` : ''}${
        dts ? '' : ` = ${emitExpression(ast.value)};`
    }`;
}
