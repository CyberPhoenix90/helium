import {
  ArrayExpression,
  ArrayTypeReference,
  BinaryExpression,
  Expression,
  Identifier,
  Literal,
  TypeExpression,
  TypeLiteral,
  TypeReference,
  TypeUnionExpression,
} from "../../../parsing/ast/ast";
import { BuiltinType } from "../../../parsing/lexer";

export function emitExpression(value: Expression) {
  switch (value.nodeType) {
    case "binaryExpression":
      return emitBinaryExpression(value as BinaryExpression);
    case "literal":
      return emitLiteral(value as Literal);
    case "identifier":
      return emitIdentifier(value as Identifier);
    case "arrayExpression":
      return emitArrayExpression(value as ArrayExpression);
  }
}

export function emitArrayExpression(value: ArrayExpression): string {
  return `[${value.elements.map((e) => emitExpression(e)).join(", ")}]`;
}

export function emitIdentifier(identifier: Identifier): string {
  return identifier.value;
}

export function emitBinaryExpression(expression: BinaryExpression): string {
  return `${emitExpression(expression.left)} ${
    expression.operation
  } ${emitExpression(expression.right)}`;
}

export function emitLiteral(value: Literal): string {
  switch (value.type) {
    case "string":
      return `"${value.value}"`;
    case "boolean":
      return value.value ? "true" : "false";
    default:
      return value.value;
  }
}

export function emitTypeExpression(type: TypeExpression): string {
  switch (type.nodeType) {
    case "typeUnionExpression":
      return emitTypeUnionExpression(type as TypeUnionExpression);
    case "typeLiteralExpression":
      return emitTypeLiteralExpression(type as TypeLiteral);
    default:
      throw new Error(`Unknown type expression ${type.nodeType}`);
  }
}

export function emitTypeUnionExpression(type: TypeUnionExpression): string {
  return `(${type.types.map((t) => emitTypeLiteralExpression(t)).join(" | ")})`;
}

function emitTypeLiteralExpression(type: TypeLiteral): string {
  switch (type.type.nodeType) {
    case "typeReference":
      return emitTypeReference(type.type as TypeReference);
    case "arrayTypeReference":
      return emitArrayTypeReference(type.type as ArrayTypeReference);
  }
}

function emitTypeReference(type: TypeReference): string {
  return `${
    type.identifier
      ? emitIdentifier(type.identifier)
      : emitBuiltInType(type.type)
  }${emitTypeArguments(type.typeArguments)}`;
}

function emitBuiltInType(type: BuiltinType): string {
  switch (type) {
    case "byte":
    case "short":
    case "int":
    case "long":
    case "ushort":
    case "uint":
    case "ulong":
    case "float":
    case "double":
      return "number";
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    case "date":
      return "Date";
    case "set":
      return "Set";
    case "map":
      return "Map";
    case "void":
      return "void";
  }
}

function emitArrayTypeReference(type: ArrayTypeReference): string {
  return `${emitTypeLiteralExpression(type.type)}[]`;
}

function emitTypeArguments(typeArguments: TypeExpression[]): string {
  if (!typeArguments?.length) {
    return "";
  } else {
    return `<${typeArguments.map(emitTypeExpression).join(", ")}>`;
  }
}
