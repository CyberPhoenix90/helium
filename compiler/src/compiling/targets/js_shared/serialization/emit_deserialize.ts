import { ArrayTypeReference, MessageDeclaration, MessageMember, OneOfMessageMember, TypeLiteral, TypeReference } from '../../../../parsing/ast/ast';
import { identifierToDeclaration } from '../../../ast_helper';
import { ParsedFile } from '../../../emitter';

export function emitMessageFactoryFromBinary(ast: MessageDeclaration, resolveImport: (src: string, path: string) => ParsedFile): string {
    const lines = [];
    for (const member of ast.members.sort((a, b) => a.fieldNumber - b.fieldNumber)) {
        if (member.nodeType === 'messageMember') {
            lines.push(emitMessageMemberFromBinary(member as MessageMember));
        } else if (member.nodeType === 'oneOfMessageMember') {
            lines.push(emitOneOfMessageMemberFromBinary(member as OneOfMessageMember));
        }
    }

    lines.push('let hasExtendedData = binaryReader.readByte();');
    lines.push('if(hasExtendedData == 1) {');
    if (ast.extends) {
        lines.push(emitMessageFactoryFromBinary(identifierToDeclaration(ast.extends, resolveImport) as MessageDeclaration, resolveImport));
    } else {
        lines.push('skipMessage()');
    }
    lines.push('}');

    return lines.join('\n');
}

function emitMessageMemberFromBinary(ast: MessageMember): string {
    const lines = [];
    const typeExpression = ast.typeExpression;

    if (typeExpression.nodeType === 'typeUnionExpression') {
        throw new Error('Union types are not yet implemented');
    }
    if (typeExpression.nodeType === 'typeLiteralExpression') {
        const typeReference = (typeExpression as TypeLiteral).type;
        const isArray = typeReference.nodeType === 'arrayTypeReference';
        const typeValue = isArray ? (typeReference as ArrayTypeReference).type.type : typeReference;

        if (typeValue.nodeType === 'arrayTypeReference') {
            throw new Error('Nested Array types are not yet implemented');
        }

        if (isArray) {
            if (typeValue.type === 'byte') {
                lines.push(emitReadIfExists(ast, () => `result.${ast.identifier.value} = binaryReader.readBytes(binaryReader.readUInt32());`));
            } else {
                lines.push(
                    emitReadIfExists(ast, () => {
                        const tmp = [];
                        tmp.push(`result.${ast.identifier.value} = [];`);
                        tmp.push(`const len = binaryReader.readUInt32();`);
                        tmp.push(`for(let i = 0; i < len; i++) {`);
                        tmp.push(emitReadType(typeValue, `result.${ast.identifier.value}.push(`) + ');');
                        tmp.push(`}`);
                        return tmp.join('\n');
                    })
                );
            }
        } else {
            lines.push(emitReadIfExists(ast, () => emitReadType(typeValue, `result.${ast.identifier.value} = `)));
        }
    }

    return lines.join('\n');
}

function emitReadIfExists(type: MessageMember, onExists?: () => string, onNotExists?: () => string): string {
    if (type.isOptional) {
        // 255 = absent
        // 0 - 254 = type union index
        return `if(binaryReader.readByte() == 255) {
            ${onNotExists ? onNotExists() : ''}
        } else {
            ${onExists ? onExists() : ''}
        }`;
    } else {
        return onExists?.() ?? '';
    }
}

function emitOneOfMessageMemberFromBinary(ast: OneOfMessageMember): string {
    return '';
}

function emitReadType(typeValue: TypeReference, prefix: string): string {
    if (typeValue.type === undefined) {
        return `${prefix}exports.${typeValue.identifier.value}Factory.fromBinary(binaryReader)`;
    }

    switch (typeValue.type) {
        case 'string':
            return `${prefix}binaryReader.readString()`;
        case 'int':
            return `${prefix}binaryReader.readInt32()`;
        case 'uint':
            return `${prefix}binaryReader.readUInt32()`;
        case 'short':
            return `${prefix}binaryReader.readInt16()`;
        case 'ushort':
            return `${prefix}binaryReader.readUInt16()`;
        case 'long':
            return `${prefix}binaryReader.readInt64()`;
        case 'ulong':
            return `${prefix}binaryReader.readUInt64()`;
        case 'float':
            return `${prefix}binaryReader.readFloat32()`;
        case 'double':
            return `${prefix}binaryReader.readFloat64()`;
        case 'boolean':
            return `${prefix}binaryReader.readBoolean()`;
        case 'byte':
            return `${prefix}binaryReader.readByte()`;
        default:
            throw new Error(`Unsupported type ${typeValue.type} in ${typeValue.text}`);
    }
}
