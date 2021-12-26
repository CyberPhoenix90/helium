import { ArrayTypeReference, MessageDeclaration, MessageMember, OneOfMessageMember, TypeLiteral, TypeReference } from '../../../../parsing/ast/ast';
import { identifierToDeclaration } from '../../../ast_helper';
import { ParsedFile } from '../../../emitter';

export function emitMessageFactoryToBinary(ast: MessageDeclaration, resolveImport: (src: string, path: string) => ParsedFile): string {
    const lines = [];
    for (const member of ast.members.sort((a, b) => a.fieldNumber - b.fieldNumber)) {
        if (member.nodeType === 'oneOfMessageMember') {
            lines.push(emitOneOfMessageMemberToBinary(member as OneOfMessageMember));
        } else {
            lines.push(emitMessageMemberToBinary(member));
        }
    }
    if (ast.extends) {
        // Message continuation marker
        lines.push(`binaryWriter.writeByte(1);`);
        lines.push(emitMessageFactoryToBinary(identifierToDeclaration(ast.extends, resolveImport) as MessageDeclaration, resolveImport));
    } else {
        // Message end marker
        lines.push(`binaryWriter.writeByte(0);`);
    }
    return lines.join('\n');
}

function emitMessageMemberToBinary(ast: MessageMember): string {
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
                lines.push(
                    emitWriteIfExists(ast, `message.${ast.identifier.value}`, () => {
                        return `binaryWriter.writeBytes(message.${ast.identifier.value});`;
                    })
                );
            } else {
                lines.push(
                    emitWriteIfExists(ast, `message.${ast.identifier.value}`, () => {
                        const tmp = [];
                        tmp.push(`binaryWriter.writeUInt32(message.${ast.identifier.value}.length);`);
                        tmp.push(`for(let i = 0; i < message.${ast.identifier.value}.length; i++) {`);
                        tmp.push(emitWriteType(typeValue, `message.${ast.identifier.value}[i]`, ast.identifier.value));
                        tmp.push(`}`);

                        return tmp.join('\n');
                    })
                );
            }
        } else {
            lines.push(
                emitWriteIfExists(ast, `message.${ast.identifier.value}`, () =>
                    emitWriteType(typeValue, `message.${ast.identifier.value}`, ast.identifier.value)
                )
            );
        }
    }

    return lines.join('\n');
}

function emitWriteIfExists(type: MessageMember, value: string, onExists?: () => string, onNotExists?: () => string): string {
    if (type.isOptional) {
        // 255 = absent
        // 0 - 254 = type union index
        return `if(${value} == undefined) {
            binaryWriter.writeByte(255);
            ${onNotExists ? onNotExists() : ''}
        } else {
            binaryWriter.writeByte(0);
            ${onExists ? onExists() : ''}
        }`;
    } else {
        return onExists?.() ?? '';
    }
}

function emitWriteType(type: TypeReference, value: string, fieldName: string): string {
    if (type.type === undefined) {
        return `exports.${type.identifier.value}Factory.toBinary(message.${fieldName},binaryWriter)`;
    }

    switch (type.type) {
        case 'boolean':
            return `binaryWriter.writeBoolean(${value});`;
        case 'int':
            return `binaryWriter.writeInt32(${value});`;
        case 'uint':
            return `binaryWriter.writeUInt32(${value});`;
        case 'long':
            return `binaryWriter.writeInt64(${value});`;
        case 'ulong':
            return `binaryWriter.writeUInt64(${value});`;
        case 'float':
            return `binaryWriter.writeFloat32(${value});`;
        case 'double':
            return `binaryWriter.writeFloat64(${value});`;
        case 'string':
            return `binaryWriter.writeString(${value});`;
        case 'byte':
            return `binaryWriter.writeByte(${value});`;
        default:
            throw new Error(`Unknown type ${type.type}`);
    }
}

function emitOneOfMessageMemberToBinary(ast: OneOfMessageMember): string {
    return '';
}
