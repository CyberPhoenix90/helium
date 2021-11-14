import { EnumDeclaration } from "../../../parsing/ast/ast";
import { emitLiteral } from "./emit_expression";
import { emitExported } from "./emit_message";

export function emitEnum(ast: EnumDeclaration, dts: boolean): string {
    if (dts) {
      return `${emitExported(ast, dts)} enum ${ast.identifier.value} {
${ast.members
  .map((m) => `    ${m.identifier.value} = ${emitLiteral(m.value)}`)
  .join(",\n")}
}\n`;
    } else {
      return `	exports.${ast.identifier.value} = {
${ast.members
  .map((m) => `	    ${m.identifier.value}: ${emitLiteral(m.value)}`)
  .join(",\n")}
	}\n`;
    }
  }
}
