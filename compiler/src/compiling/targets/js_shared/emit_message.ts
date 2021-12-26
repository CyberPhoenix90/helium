import { Identifier, MessageDeclaration, MessageMember, OneOfMessageMember } from '../../../parsing/ast/ast';
import { ParsedFile } from '../../emitter';
import { emitTypeExpression } from './emit_expression';
import { emitMessageFactoryFromBinary } from './serialization/emit_deserialize';
import { emitMessageFactoryToBinary } from './serialization/emit_serialize';

export function emitMessageFactoryDts(ast: MessageDeclaration): string {
    return `	export const ${ast.identifier.value}Factory:HeliumMessageFactory<${ast.identifier.value}>;`;
}

export function emitExported(ast: { isExported: boolean }, dts: boolean) {
    return ast.isExported ? (dts ? 'export ' : 'exports.') : '';
}

export function emitMessageDeclaration(ast: MessageDeclaration): string {
    return `	${emitExported(ast, true)}interface ${ast.identifier.value}${emitExtends(ast.extends)} {
    ${ast.members.map((member) => emitMessageMember(member)).join('\n')}
}`;
}

function emitExtends(ext: Identifier): string {
    if (!ext) {
        return '';
    } else {
        return ` extends ${ext.value}`;
    }
}

function emitMessageMember(member: MessageMember | OneOfMessageMember): string {
    if (member.nodeType === 'oneOfMessageMember') {
        return `${member.identifier.value}: { ${emitOneOfMessageMember(member as OneOfMessageMember)} };`;
    } else {
        return `${member.identifier.value}${emitOptional(member.isOptional)}: ${emitTypeExpression(member.typeExpression)};`;
    }
}

function emitOneOfMessageMember(member: OneOfMessageMember): string {
    return member.subMembers.map((subMember) => `${subMember.identifier.value}?: ${emitTypeExpression(subMember.typeExpression)}`).join(';\n');
}

function emitOptional(isOptional: boolean): string {
    return isOptional ? '?' : '';
}

export function emitMessageFactory(ast: MessageDeclaration, resolveImport: (src: string, path: string) => ParsedFile): string {
    return `	exports.${ast.identifier.value}Factory = {
    validate() {

    },
    fromBinary(binaryReader, result = {}) {
        ${emitMessageFactoryFromBinary(ast, resolveImport)}
        exports.${ast.identifier.value}Factory.validate(result);
        return result;
    },
    toBinary(message, binaryWriter) {
        ${emitMessageFactoryToBinary(ast, resolveImport)}
    },
    fromJson(json) {
        return ${ast.identifier.value}Factory.createInstance(JSON.parse(json));
    },
    toJson(message) {
        return JSON.stringify(message);
    },
    createInstance(message) {
        ${ast.identifier.value}Factory.validate(message);
        return message;
    }
};\n`;
}
