import {
  ArrayTypeReference,
  Identifier,
  MessageDeclaration,
  MessageMember,
  OneOfMessageMember,
  TypeLiteral,
  TypeReference,
} from "../../../parsing/ast/ast";
import { emitLiteral } from "./emit_expression";

export function emitMessageFactoryDts(ast: MessageDeclaration): string {
  return `	export const ${ast.identifier.value}Factory:HeliumMessageFactory<${ast.identifier.value}>;`;
}

export function emitExported(ast: { isExported: boolean }, dts: boolean) {
  return ast.isExported ? (dts ? "export " : "exports.") : "";
}

export function emitMessageDeclaration(ast: MessageDeclaration): string {
  return `	${emitExported(ast, true)}interface ${
    ast.identifier.value
  }${emitExtends(ast.extends)} {
    ${ast.members.map((member) => emitMessageMember(member)).join("\n")}
}`;
}

function emitExtends(ext: Identifier[]): string {
  if (!ext?.length) {
    return "";
  } else {
    return ` extends ${ext.map(emitLiteral).join(", ")}`;
  }
}

function emitMessageMember(member: MessageMember | OneOfMessageMember): string {
  if (member.nodeType === "oneOfMessageMember") {
    return `${member.identifier.value}: { ${emitOneOfMessageMember(
      member as OneOfMessageMember
    )} };`;
  } else {
    return `${member.identifier.value}${emitOptional(
      member.isOptional
    )}: ${emitTypeExpression(member.typeExpression)};`;
  }
}

function emitOneOfMessageMember(member: OneOfMessageMember): string {
  return member.subMembers
    .map(
      (subMember) =>
        `${subMember.identifier.value}?: ${emitTypeExpression(
          subMember.typeExpression
        )}`
    )
    .join(";\n");
}

function emitOptional(isOptional: boolean): string {
  return isOptional ? "?" : "";
}

export function emitMessageFactory(ast: MessageDeclaration): string {
  return `	exports.${ast.identifier.value}Factory = {
    validate() {

    },
    fromBinary(binaryReader) {
        const result = {};
        ${emitMessageFactoryFromBinary(ast)}
        exports.${ast.identifier.value}Factory.validate(result);
        return result;
    },
    toBinary(message, binaryWriter) {
        ${emitMessageFactoryToBinary(ast)}
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

function emitMessageFactoryToBinary(ast: MessageDeclaration): string {
  const lines = [];
  for (const member of ast.members.sort(
    (a, b) => a.fieldNumber - b.fieldNumber
  )) {
    if (member.nodeType === "oneOfMessageMember") {
      lines.push(emitOneOfMessageMemberToBinary(member as OneOfMessageMember));
    } else {
      lines.push(emitMessageMemberToBinary(member));
    }
  }
  return lines.join("\n");
}

function emitMessageFactoryFromBinary(ast: MessageDeclaration): string {
  const lines = [];
  for (const member of ast.members.sort(
    (a, b) => a.fieldNumber - b.fieldNumber
  )) {
    if (member.nodeType === "messageMember") {
      lines.push(emitMessageMemberFromBinary(member as MessageMember));
    } else if (member.nodeType === "oneOfMessageMember") {
      lines.push(
        emitOneOfMessageMemberFromBinary(member as OneOfMessageMember)
      );
    }
  }
  return lines.join("\n");
}

function emitMessageMemberFromBinary(ast: MessageMember): string {
  const lines = [];
  const typeExpression = ast.typeExpression;

  if (typeExpression.nodeType === "typeUnionExpression") {
    throw new Error("Union types are not yet implemented");
  }
  if (typeExpression.nodeType === "typeLiteralExpression") {
    const typeReference = (typeExpression as TypeLiteral).type;
    const isArray = typeReference.nodeType === "arrayTypeReference";
    const typeValue = isArray
      ? (typeReference as ArrayTypeReference).type.type
      : typeReference;

    if (typeValue.nodeType === "arrayTypeReference") {
      throw new Error("Nested Array types are not yet implemented");
    }

    if (isArray) {
      if (typeValue.type === "byte") {
        lines.push(
          emitReadIfExists(
            ast,
            () =>
              `result.${ast.identifier.value} = binaryReader.readBytes(binaryReader.readUInt32());`
          )
        );
      } else {
        lines.push(
          emitReadIfExists(ast, () => {
            const tmp = [];
            tmp.push(`result.${ast.identifier.value} = [];`);
            tmp.push(`const len = binaryReader.readUInt32();`);
            tmp.push(`for(let i = 0; i < len; i++) {`);
            tmp.push(
              emitReadType(typeValue, `result.${ast.identifier.value}.push(`) +
                ");"
            );
            tmp.push(`}`);
            return tmp.join("\n");
          })
        );
      }
    } else {
      lines.push(
        emitReadIfExists(ast, () =>
          emitReadType(typeValue, `result.${ast.identifier.value} = `)
        )
      );
    }
  }

  return lines.join("\n");
}

function emitMessageMemberToBinary(ast: MessageMember): string {
  const lines = [];
  const typeExpression = ast.typeExpression;

  if (typeExpression.nodeType === "typeUnionExpression") {
    throw new Error("Union types are not yet implemented");
  }
  if (typeExpression.nodeType === "typeLiteralExpression") {
    const typeReference = (typeExpression as TypeLiteral).type;
    const isArray = typeReference.nodeType === "arrayTypeReference";
    const typeValue = isArray
      ? (typeReference as ArrayTypeReference).type.type
      : typeReference;

    if (typeValue.nodeType === "arrayTypeReference") {
      throw new Error("Nested Array types are not yet implemented");
    }

    if (isArray) {
      if (typeValue.type === "byte") {
        lines.push(
          emitWriteIfExists(ast, `message.${ast.identifier.value}`, () => {
            return `binaryWriter.writeBytes(message.${ast.identifier.value});`;
          })
        );
      } else {
        lines.push(
          emitWriteIfExists(ast, `message.${ast.identifier.value}`, () => {
            const tmp = [];
            tmp.push(
              `binaryWriter.writeUInt32(message.${ast.identifier.value}.length);`
            );
            tmp.push(
              `for(let i = 0; i < message.${ast.identifier.value}.length; i++) {`
            );
            tmp.push(
              emitWriteType(typeValue, `message.${ast.identifier.value}[i]`)
            );
            tmp.push(`}`);

            return tmp.join("\n");
          })
        );
      }
    } else {
      lines.push(
        emitWriteIfExists(ast, `message.${ast.identifier.value}`, () =>
          emitWriteType(typeValue, `message.${ast.identifier.value}`)
        )
      );
    }
  }

  return lines.join("\n");
}

function emitWriteIfExists(
  type: MessageMember,
  value: string,
  onExists?: () => string,
  onNotExists?: () => string
): string {
  if (type.isOptional) {
    // 255 = absent
    // 0 - 254 = type union index
    return `if(${value} == undefined) {
            binaryWriter.writeByte(255);
            ${onNotExists ? onNotExists() : ""}
        } else {
            binaryWriter.writeByte(0);
            ${onExists ? onExists() : ""}
        }`;
  } else {
    return onExists?.() ?? "";
  }
}

function emitReadIfExists(
  type: MessageMember,
  onExists?: () => string,
  onNotExists?: () => string
): string {
  if (type.isOptional) {
    // 255 = absent
    // 0 - 254 = type union index
    return `if(binaryReader.readByte() == 255) {
            ${onNotExists ? onNotExists() : ""}
        } else {
            ${onExists ? onExists() : ""}
        }`;
  } else {
    return onExists?.() ?? "";
  }
}

function emitWriteType(type: TypeReference, value: string): string {
  switch (type.type) {
    case "boolean":
      return `binaryWriter.writeBoolean(${value});`;
    case "int":
      return `binaryWriter.writeInt32(${value});`;
    case "uint":
      return `binaryWriter.writeUInt32(${value});`;
    case "long":
      return `binaryWriter.writeInt64(${value});`;
    case "ulong":
      return `binaryWriter.writeUInt64(${value});`;
    case "float":
      return `binaryWriter.writeFloat32(${value});`;
    case "double":
      return `binaryWriter.writeFloat64(${value});`;
    case "string":
      return `binaryWriter.writeString(${value});`;
    case "byte":
      return `binaryWriter.writeByte(${value});`;
    default:
      throw new Error(`Unknown type ${type.type}`);
  }
}

function emitOneOfMessageMemberFromBinary(ast: OneOfMessageMember): string {
  return "";
}

function emitOneOfMessageMemberToBinary(ast: OneOfMessageMember): string {
  return "";
}

function emitReadType(typeValue: TypeReference, prefix: string): string {
  switch (typeValue.type) {
    case "string":
      return `${prefix}binaryReader.readString()`;
    case "int":
      return `${prefix}binaryReader.readInt32()`;
    case "uint":
      return `${prefix}binaryReader.readUInt32()`;
    case "short":
      return `${prefix}binaryReader.readInt16()`;
    case "ushort":
      return `${prefix}binaryReader.readUInt16()`;
    case "long":
      return `${prefix}binaryReader.readInt64()`;
    case "ulong":
      return `${prefix}binaryReader.readUInt64()`;
    case "float":
      return `${prefix}binaryReader.readFloat32()`;
    case "double":
      return `${prefix}binaryReader.readFloat64()`;
    case "boolean":
      return `${prefix}binaryReader.readBoolean()`;
    case "byte":
      return `${prefix}binaryReader.readByte()`;
    default:
      throw new Error(
        `Unsupported type ${typeValue.type} in ${typeValue.text}`
      );
  }
}
