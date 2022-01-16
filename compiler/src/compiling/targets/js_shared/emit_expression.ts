import {
    ArrayExpression,
    ArrayTypeReference,
    BinaryExpression,
    CallExpression,
    Expression,
    Identifier,
    Literal,
    TypeExpression,
    TypeLiteral,
    TypeReference,
    TypeUnionExpression,
} from '../../../parsing/ast/ast';
import { BuiltinType } from '../../../parsing/lexer';
import { resolveExpressionValue } from '../../ast_helper';
import { timespan, TimeUnits } from '../../builtins/time_span';
import { ParsedFile } from '../../emitter';

export function emitExpression(value: Expression, resolveImport: (src: string, path: string) => ParsedFile) {
    switch (value.nodeType) {
        case 'binaryExpression':
            return emitBinaryExpression(value as BinaryExpression, resolveImport);
        case 'literal':
            return emitLiteral(value as Literal);
        case 'identifier':
            return emitIdentifier(value as Identifier);
        case 'arrayExpression':
            return emitArrayExpression(value as ArrayExpression, resolveImport);
        case 'callExpression':
            return emitCallExpression(value as CallExpression, resolveImport);
    }
}

export function emitCallExpression(callExpression: CallExpression, resolveImport: (src: string, path: string) => ParsedFile): string {
    switch (callExpression.identifier.value) {
        case 'timespan':
            if (callExpression.arguments.length === 0) {
                throw new Error('timespan requires at least one argument');
            }
            if (callExpression.arguments.length > 2) {
                throw new Error('timespan uses at most two arguments');
            }

            const timeExpression = callExpression.arguments[0];
            if (timeExpression.nodeType !== 'literal' && timeExpression.nodeType !== 'identifier') {
                throw new Error('timespan only supports literal or identifier for time expression');
            }
            let timeExpressionValue = resolveExpressionValue(timeExpression as Literal | Identifier, resolveImport);
            let unit = TimeUnits.MILLISECONDS;

            if (callExpression.arguments[1]) {
                const unitExpression = callExpression.arguments[1];
                if (unitExpression.nodeType !== 'literal' && unitExpression.nodeType !== 'identifier') {
                    throw new Error('timespan only supports literal or identifier for unit');
                }
                const unitValue = resolveExpressionValue(unitExpression as Literal | Identifier, resolveImport);
                if (typeof unitValue === 'string') {
                    unit = TimeUnits[unitValue.toUpperCase()];
                } else {
                    throw new Error('timespan only supports string for unit');
                }
            }

            if (typeof timeExpressionValue === 'string') {
                timeExpressionValue = timespan(timeExpressionValue, unit);
            } else {
                throw new Error('timespan only supports string for time expression');
            }

            return timeExpressionValue;
        default:
            throw new Error(`Unknown function ${callExpression.identifier.value}`);
    }
}

export function emitArrayExpression(value: ArrayExpression, resolveImport: (src: string, path: string) => ParsedFile): string {
    return `[${value.elements.map((e) => emitExpression(e, resolveImport)).join(', ')}]`;
}

export function emitIdentifier(identifier: Identifier): string {
    return identifier.value;
}

export function emitBinaryExpression(expression: BinaryExpression, resolveImport: (src: string, path: string) => ParsedFile): string {
    return `${emitExpression(expression.left, resolveImport)} ${expression.operation} ${emitExpression(expression.right, resolveImport)}`;
}

export function emitLiteral(value: Literal): string {
    switch (value.type) {
        case 'string':
            return `"${value.value}"`;
        case 'boolean':
            return value.value ? 'true' : 'false';
        default:
            return value.value;
    }
}

export function emitTypeExpression(type: TypeExpression): string {
    switch (type.nodeType) {
        case 'typeUnionExpression':
            return emitTypeUnionExpression(type as TypeUnionExpression);
        case 'typeLiteralExpression':
            return emitTypeLiteralExpression(type as TypeLiteral);
        default:
            throw new Error(`Unknown type expression ${type.nodeType}`);
    }
}

export function emitTypeUnionExpression(type: TypeUnionExpression): string {
    return `(${type.types.map((t) => emitTypeLiteralExpression(t)).join(' | ')})`;
}

function emitTypeLiteralExpression(type: TypeLiteral): string {
    switch (type.type.nodeType) {
        case 'typeReference':
            return emitTypeReference(type.type as TypeReference);
        case 'arrayTypeReference':
            return emitArrayTypeReference(type.type as ArrayTypeReference);
    }
}

function emitTypeReference(type: TypeReference): string {
    return `${type.identifier ? emitIdentifier(type.identifier) : emitBuiltInType(type.type)}${emitTypeArguments(type.typeArguments)}`;
}

function emitBuiltInType(type: BuiltinType): string {
    switch (type) {
        case 'byte':
        case 'short':
        case 'int':
        case 'long':
        case 'ushort':
        case 'uint':
        case 'ulong':
        case 'float':
        case 'double':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'string':
            return 'string';
        case 'date':
            return 'Date';
        case 'set':
            return 'Set';
        case 'map':
            return 'Map';
        case 'void':
            return 'void';
    }
}

function emitArrayTypeReference(type: ArrayTypeReference): string {
    return `${emitTypeLiteralExpression(type.type)}[]`;
}

function emitTypeArguments(typeArguments: TypeExpression[]): string {
    if (!typeArguments?.length) {
        return '';
    } else {
        return `<${typeArguments.map(emitTypeExpression).join(', ')}>`;
    }
}
