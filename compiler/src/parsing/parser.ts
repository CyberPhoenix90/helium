import {
    Annotation,
    ArrayExpression,
    ArrayTypeReference,
    ASTRoot,
    BinaryExpression,
    CallExpression,
    ConstDeclaration,
    EnumDeclaration,
    EnumMember,
    Expression,
    Identifier,
    ImportSpecifier,
    ImportStatement,
    Literal,
    MessageDeclaration,
    MessageMember,
    OneOfMessageMember,
    Reexport,
    ServiceApiCall,
    ServiceDeclaration,
    TopLevelStatement,
    TypeAliasDeclaration,
    TypeExpression,
    TypeLiteral,
    TypeReference,
    TypeUnionExpression,
} from './ast/ast';
import { builtinTypes, Keyword, TokenStream } from './lexer';

export function parser(input: TokenStream): ASTRoot {
    const statements = [];

    const root: ASTRoot = {
        root: undefined,
        character: 0,
        line: 0,
        file: input.file,
        text: input.source,
        nodeType: 'program',
        children: statements,
        statements,
    };
    root.root = root;

    while (!input.eof()) {
        const statement = parseTopLevelStatement(input, root);
        statements.push(statement);
    }

    return root;
}

function isOperation(input: TokenStream, operation?: string): boolean {
    const token = input.peek();
    return token && token.type == 'operation' && (!operation || token.value === operation);
}

function skipOperation(input: TokenStream, operation: string): void {
    if (isOperation(input, operation)) {
        input.next();
    } else {
        input.croak(`Expecting operation: "${operation}" but found ${input.peek().value}`);
    }
}

function isPunctuation(input: TokenStream, ch?: string): boolean {
    const token = input.peek();
    return token && token.type == 'punctuation' && (!ch || token.value === ch);
}

function isKeyword(input: TokenStream, keyword?: Keyword): boolean {
    const token = input.peek();
    return token && token.type == 'keyword' && (!keyword || token.value === keyword);
}

function skipPunctuation(input: TokenStream, ch?: string): void {
    if (isPunctuation(input, ch)) {
        input.next();
    } else {
        input.croak(`Expecting punctuation: "${ch}" but found ${input.peek().value}`);
    }
}

function skipArrow(input: TokenStream): void {
    if (isArrow(input)) {
        input.next();
    } else {
        input.croak(`Expecting arrow: "->" but found ${input.peek().value}`);
    }
}

function isArrow(input: TokenStream): boolean {
    const token = input.peek();
    return token && token.type == 'arrow' && token.value === '->';
}

function skipKeyword(input: TokenStream, keyword: Keyword): void {
    if (isKeyword(input, keyword)) {
        input.next();
    } else {
        input.croak(`Expecting keyword: "${keyword}" but found ${input.peek().value}`);
    }
}

function unexpected(input: TokenStream, expected: string, actual: string): never {
    input.croak(`Expecting: "${expected}" but found ${actual}`);
}

function parseTopLevelStatement(input: TokenStream, root: ASTRoot): TopLevelStatement {
    let token = input.peek();

    if (!token) {
        throw new Error('illegal state');
    }

    let isExported = false;

    let result;
    if (token.type === 'keyword') {
        if (token.value === 'export') {
            skipKeyword(input, 'export');
            if (isPunctuation(input, '{')) {
                return parseReexport(input, root);
            } else {
                isExported = true;
                token = input.peek();
            }
        }

        switch (token.value) {
            case 'message':
                result = parseMessageDeclaration(input, root, isExported);
                isExported = false;
                return result;
            case 'const':
                result = parseConstDeclaration(input, root, isExported);
                isExported = false;
                return result;
            case 'type':
                result = parseTypeAliasDeclaration(input, root, isExported);
                isExported = false;
                return result;
            case 'enum':
                result = parseEnumDeclaration(input, root, isExported);
                isExported = false;
                return result;
            case 'client':
            case 'service':
                result = parseServiceDeclaration(input, root, isExported);
                isExported = false;
                return result;
            case 'import':
                if (isExported) {
                    unexpected(input, 'const, message, service or interface', 'import keyword');
                }
                const imp = parseImport(input, root);
                skipPunctuation(input, ';');
                return imp;
            default:
                unexpected(input, 'start of statement', token.value);
        }
    } else {
        unexpected(input, 'start of statement', token.value);
    }
}

function parseReexport(input: TokenStream, root: ASTRoot): Reexport {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    skipPunctuation(input, '{');
    const importSpecifiers = [];
    while (input.peek() && input.peek().value !== '}') {
        importSpecifiers.push(parseImportSpecifier(input, root));
        if (input.peek() && input.peek().value === ',') {
            input.next();
        }
    }
    skipPunctuation(input, '}');
    skipKeyword(input, 'from');
    const path = input.next();
    if (path.type !== 'string') {
        unexpected(input, 'file path', path.value);
    }
    return {
        root,
        character: startCharacter,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        nodeType: 'reexport',
        path: path.value,
        children: importSpecifiers,
        importSpecifiers,
    };
}

function parseTypeAliasDeclaration(input: TokenStream, root: ASTRoot, isExported: boolean): TypeAliasDeclaration {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    skipKeyword(input, 'type');
    const identifier = parseIdentifier(input, root);
    skipOperation(input, '=');
    const type = parseTypeExpression(input, root);
    skipPunctuation(input, ';');
    return {
        root,
        character: startCharacter,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        nodeType: 'typeAliasDeclaration',
        identifier,
        type,
        children: [identifier, type],
        isExported,
    };
}

function parseServiceDeclaration(input: TokenStream, root: ASTRoot, isExported: boolean): ServiceDeclaration {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    let isClient = false;
    if (isKeyword(input, 'client')) {
        skipKeyword(input, 'client');
        isClient = true;
    }
    skipKeyword(input, 'service');
    const identifier = parseIdentifier(input, root);
    skipPunctuation(input, '{');
    const data = parseServiceData(input, root);
    skipPunctuation(input, '}');
    return {
        root,
        character: startCharacter,
        isClient,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        nodeType: 'serviceDeclaration',
        identifier,
        apiCalls: data.filter((e) => e.nodeType === 'serviceApiCall') as ServiceApiCall[],
        constants: data.filter((e) => e.nodeType === 'constDeclaration') as ConstDeclaration[],
        isExported,
        children: [identifier, ...data],
    };
}

function parseServiceData(input: TokenStream, root: ASTRoot): (ServiceApiCall | ConstDeclaration)[] {
    const members: (ServiceApiCall | ConstDeclaration)[] = [];
    while (!isPunctuation(input, '}')) {
        const annotations: Annotation[] = [];
        while (isPunctuation(input, '@')) {
            annotations.push(parseAnnotation(input, root));
        }

        const token = input.peek();
        if (token.value === 'const') {
            if (annotations.length > 0) {
                input.croak(`Const declarations do not support annotations`);
            }
            members.push(parseConstDeclaration(input, root, undefined));
        } else {
            const member = parseServiceApiCall(input, root, annotations);
            members.push(member);
        }
    }
    return members;
}

function parseServiceApiCall(input: TokenStream, root: ASTRoot, annotations: Annotation[]): ServiceApiCall {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    let protocol;
    if (isKeyword(input, 'http')) {
        protocol = 'http';
        skipKeyword(input, 'http');
    } else if (isKeyword(input, 'tcp')) {
        protocol = 'tcp';
        skipKeyword(input, 'tcp');
    } else if (isKeyword(input, 'ws')) {
        protocol = 'ws';
        skipKeyword(input, 'ws');
    } else {
        unexpected(input, 'http, tcp, or ws', input.peek().value);
    }

    const identifier = parseIdentifier(input, root);
    skipPunctuation(input, '(');
    const arg = parseTypeExpression(input, root);
    skipPunctuation(input, ')');
    skipPunctuation(input, ':');
    const returnType = parseTypeExpression(input, root);
    let throws;

    if (isKeyword(input, 'throws')) {
        skipKeyword(input, 'throws');
        throws = parseTypeExpression(input, root);
    }
    skipPunctuation(input, ';');
    return {
        character: startCharacter,
        root,
        protocol,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        nodeType: 'serviceApiCall',
        identifier,
        annotations,
        errorType: throws,
        returnType,
        argument: arg,
        children: [...annotations, identifier, arg, returnType, throws],
    };
}

function parseEnumDeclaration(input: TokenStream, root: ASTRoot, isExported: boolean): EnumDeclaration {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    skipKeyword(input, 'enum');
    const identifier = parseIdentifier(input, root);

    skipPunctuation(input, '{');
    const members = parseEnumMembers(input, root);
    skipPunctuation(input, '}');
    return {
        root,
        character: startCharacter,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        identifier,
        members,
        nodeType: 'enumDeclaration',
        isExported,
        children: [identifier, ...members],
    };
}

function parseEnumMembers(input: TokenStream, root: ASTRoot): EnumMember[] {
    const members = [];
    while (!isPunctuation(input, '}')) {
        const member = parseEnumMember(input, root);
        members.push(member);
    }
    return members;
}

function parseEnumMember(input: TokenStream, root: ASTRoot): EnumMember {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    const identifier = parseIdentifier(input, root);
    skipOperation(input, '=');
    const value = parseLiteral(input, root);
    if (isPunctuation(input, ';')) {
        skipPunctuation(input, ';');
    } else if (isPunctuation(input, ',')) {
        skipPunctuation(input, ',');
    } else {
        unexpected(input, `',' or ';'`, input.peek().value);
    }
    return {
        root,
        character: startCharacter,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        identifier,
        value,
        nodeType: 'enumMember',
        children: [identifier, value],
    };
}

function parseMessageDeclaration(input: TokenStream, root: ASTRoot, isExported: boolean): MessageDeclaration {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    skipKeyword(input, 'message');
    const identifier = parseIdentifier(input, root);

    const extendsIdentifiers: Identifier[] = [];
    if (isKeyword(input, 'extends')) {
        skipKeyword(input, 'extends');
        do {
            extendsIdentifiers.push(parseIdentifier(input, root));
        } while (isPunctuation(input, ',') && (skipPunctuation(input, ','), true));
    }

    skipPunctuation(input, '{');
    const fields = parseFields(input, root);
    skipPunctuation(input, '}');
    return {
        root,
        character: startCharacter,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        extends: extendsIdentifiers,
        identifier,
        members: fields,
        nodeType: 'messageDeclaration',
        isExported,
        children: [identifier, ...extendsIdentifiers, ...fields],
    };
}

function parseFields(input: TokenStream, root: ASTRoot): MessageMember[] {
    const fields = [];
    while (!isPunctuation(input, '}')) {
        const field = parseField(input, root);
        fields.push(field);
    }
    return fields;
}

function parseField(input: TokenStream, root: ASTRoot): MessageMember | OneOfMessageMember {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    const annotations: Annotation[] = [];
    while (isPunctuation(input, '@')) {
        annotations.push(parseAnnotation(input, root));
    }

    const fieldNumber = parseNumber(input);
    skipArrow(input);

    let isOneOf = false;
    if (isKeyword(input, 'oneof')) {
        skipKeyword(input, 'oneof');
        isOneOf = true;
    }

    const identifier = parseIdentifier(input, root);
    if (isOneOf) {
        skipPunctuation(input, '{');
        const oneOfFields = parseFields(input, root);
        skipPunctuation(input, '}');
        return {
            character: startCharacter,
            line: startLine,
            text: input.source.substring(startIndex, input.getCarret().index),
            identifier,
            fieldNumber,
            subMembers: oneOfFields,
            nodeType: 'oneOfMessageMember',
        } as OneOfMessageMember;
    } else {
        skipPunctuation(input, ':');
        const typeExpression = parseTypeExpression(input, root);
        let defaultValue: Expression;
        if (isOperation(input, '=')) {
            skipOperation(input, '=');
            defaultValue = parseExpression(input, root);
        }
        skipPunctuation(input, ';');
        return {
            root,
            character: startCharacter,
            line: startLine,
            text: input.source.substring(startIndex, input.getCarret().index),
            typeExpression,
            fieldNumber,
            annotations,
            isOptional: defaultValue !== undefined,
            defaultValue,
            identifier,
            nodeType: 'messageMember',
            children: [...annotations, identifier, typeExpression, defaultValue].filter(Boolean),
        };
    }
}

function parseAnnotation(input: TokenStream, root: ASTRoot): Annotation {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    skipPunctuation(input, '@');
    const identifier = parseIdentifier(input, root);
    const args = parseCallArguments(input, root);
    return {
        root,
        character: startCharacter,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        identifier,
        arguments: args,
        nodeType: 'annotation',
        children: [identifier, ...args],
    };
}

function parseNumber(input: TokenStream): number {
    const token = input.peek();
    if (token.type === 'int') {
        input.next();
        if (token.value < 0) {
            input.croak(`Field number must be a positive 32 bit integer. Found ${token.value}`);
        }
        return token.value;
    }
    input.croak(`Expecting 32 bit integer but found type ${token.type}`);
}

function parseLiteral(input: TokenStream, root: ASTRoot): Literal {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    const token = input.next();

    if (!builtinTypes.includes(token.type as any)) {
        unexpected(input, `literal`, `type ${token.type}`);
    }

    return {
        root,
        nodeType: 'literal',
        character: startCharacter,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        type: token.type,
        value: token.value,
        children: [],
    };
}

function parseExpression(input: TokenStream, root: ASTRoot): Expression {
    if (isPunctuation(input, '(')) {
        input.next();
        const e = parseExpression(input, root);
        skipPunctuation(input, ')');
        return e;
    }

    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    const token = input.next();
    if (!token) {
        unexpected(input, 'expression', 'eof');
    }

    switch (token.type) {
        case 'int':
        case 'long':
        case 'byte':
        case 'uint':
        case 'ulong':
        case 'date':
        case 'string':
        case 'boolean':
        case 'float':
        case 'double':
        case 'null':
            input.backtrack();
            return buildExpression(input, root, parseLiteral(input, root));
        case 'punctuation':
            if (token.value === '[') {
                input.backtrack();
                return parseArray(input, root);
            } else {
                unexpected(input, 'expression', token.value);
            }
        case 'identifier':
            if (isPunctuation(input, '(')) {
                input.backtrack();
                const id = parseIdentifier(input, root);
                const args = parseCallArguments(input, root);
                return buildExpression(input, root, {
                    nodeType: 'callExpression',
                    character: startCharacter,
                    line: startLine,
                    text: input.source.substring(startIndex, input.getCarret().index),
                    arguments: args,
                    identifier: id,
                    value: token.value,
                } as CallExpression);
            } else {
                return buildExpression(input, root, {
                    nodeType: 'identifier',
                    root,
                    character: startCharacter,
                    line: startLine,
                    text: input.source.substring(startIndex, input.getCarret().index),
                    value: token.value,
                } as Identifier);
            }
        default:
            unexpected(input, 'expression', token.value);
    }
}

function parseCallArguments(input: TokenStream, root: ASTRoot): Expression[] {
    const result: Expression[] = [];
    skipPunctuation(input, '(');
    while (!isPunctuation(input, ')')) {
        result.push(parseExpression(input, root));
        if (input.peek() && input.peek().value === ',') {
            input.next();
        }
    }
    skipPunctuation(input, ')');
    return result;
}

function buildExpression(input: TokenStream, root: ASTRoot, left: Literal | Expression | Identifier): Expression {
    if (isOperation(input)) {
        return {
            nodeType: 'binaryExpression',
            root,
            left,
            operation: input.next().value,
            right: parseExpression(input, root),
        } as BinaryExpression;
    } else {
        return left;
    }
}

function parseIdentifier(input: TokenStream, root: ASTRoot): Identifier {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    const token = input.next();
    if (!token) {
        unexpected(input, 'identifier', 'eof');
    }

    if (token.type !== 'identifier') {
        unexpected(input, 'identifier', token.value);
    } else {
        return {
            root,
            character: startCharacter,
            line: startLine,
            text: input.source.substring(startIndex, input.getCarret().index),
            nodeType: 'identifier',
            value: token.value,
            children: [],
        };
    }
}

function parseTypeExpression(input: TokenStream, root: ASTRoot): TypeExpression {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    const literals: TypeLiteral[] = [];
    do {
        literals.push(parseTypeLiteral(input, root));
    } while (isPunctuation(input, '|') && (skipPunctuation(input, '|'), true));

    if (literals.length === 1) {
        return literals[0];
    } else {
        return {
            root,
            character: startCharacter,
            line: startLine,
            text: input.source.substring(startIndex, input.getCarret().index),
            nodeType: 'typeUnionExpression',
            types: literals,
        } as TypeUnionExpression;
    }
}

function parseTypeLiteral(input: TokenStream, root: ASTRoot): TypeLiteral {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    const type = parseType(input, root);
    return {
        root,
        character: startCharacter,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        nodeType: 'typeLiteralExpression',
        type,
        children: [],
    };
}

function parseType(input: TokenStream, root: ASTRoot): TypeReference | ArrayTypeReference {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    const token = input.next();
    if (!token) {
        unexpected(input, 'type', 'eof');
    }

    let identifier;
    let typeArgs: TypeExpression[];

    if (token.type === 'identifier') {
        input.backtrack();
        identifier = parseIdentifier(input, root);
        if (isPunctuation(input, '<')) {
            typeArgs = parseTypeArguments(input, root);
        }
    }

    if (token.type !== 'type' && !identifier) {
        unexpected(input, 'type', token.value);
    }

    let baseType: TypeReference = {
        root,
        character: startCharacter,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        nodeType: 'typeReference',
        typeArguments: typeArgs,
        identifier: identifier,
        type: identifier ? undefined : token.value,
        children: [],
    };
    let wrappedType: TypeReference | ArrayTypeReference = baseType;

    while (isPunctuation(input, '[')) {
        skipPunctuation(input, '[');
        skipPunctuation(input, ']');
        wrappedType = {
            character: startCharacter,
            line: startLine,
            text: input.source.substring(startIndex, input.getCarret().index),
            nodeType: 'arrayTypeReference',
            type: {
                character: startCharacter,
                line: startLine,
                text: input.source.substring(startIndex, input.getCarret().index),
                nodeType: 'typeLiteralExpression',
                type: wrappedType,
            },
        } as ArrayTypeReference;
    }

    return wrappedType;
}

function parseTypeArguments(input: TokenStream, root: ASTRoot): TypeExpression[] {
    const result: TypeExpression[] = [];
    skipPunctuation(input, '<');
    while (!isPunctuation(input, '>')) {
        result.push(parseTypeExpression(input, root));
        if (input.peek() && input.peek().value === ',') {
            input.next();
        }
    }
    skipPunctuation(input, '>');
    return result;
}

function parseImportSpecifier(input: TokenStream, root: ASTRoot): ImportSpecifier {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    const identifier = parseIdentifier(input, root);
    let alias: Identifier;
    if (isKeyword(input, 'as')) {
        skipKeyword(input, 'as');
        alias = parseIdentifier(input, root);
    }
    return {
        character: startCharacter,
        root,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        nodeType: 'importSpecifier',
        identifier: alias ? alias : identifier,
        originalName: alias ? identifier : undefined,
        children: [identifier, alias].filter(Boolean),
    };
}

function parseImport(input: TokenStream, root: ASTRoot): ImportStatement {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    skipKeyword(input, 'import');
    skipPunctuation(input, '{');
    const importSpecifiers = [];
    while (input.peek() && input.peek().value !== '}') {
        importSpecifiers.push(parseImportSpecifier(input, root));
        if (input.peek() && input.peek().value === ',') {
            input.next();
        }
    }
    skipPunctuation(input, '}');
    skipKeyword(input, 'from');

    const path = input.next();
    if (path.type !== 'string') {
        unexpected(input, 'file path', path.value);
    }

    return {
        character: startCharacter,
        line: startLine,
        root,
        text: input.source.substring(startIndex, input.getCarret().index),
        nodeType: 'import',
        importedFilePath: path.value,
        importSpecifiers,
        children: importSpecifiers,
    };
}

function parseConstDeclaration(input: TokenStream, root: ASTRoot, isExported: boolean): ConstDeclaration {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    skipKeyword(input, 'const');
    const identifier = parseIdentifier(input, root);
    skipPunctuation(input, ':');
    const type = parseTypeExpression(input, root);
    skipOperation(input, '=');
    const value = parseExpression(input, root);
    skipPunctuation(input, ';');
    return {
        root,
        character: startCharacter,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        nodeType: 'constDeclaration',
        type,
        isExported,
        identifier,
        value,
        children: [type, value],
    };
}

function parseArray(input: TokenStream, root: ASTRoot): ArrayExpression {
    const { character: startCharacter, line: startLine, index: startIndex } = input.getCarret();
    skipPunctuation(input, '[');
    const elements = [];
    while (!isPunctuation(input, ']')) {
        elements.push(parseExpression(input, root));
        if (input.peek() && input.peek().value === ',') {
            input.next();
        }
    }
    skipPunctuation(input, ']');
    return {
        character: startCharacter,
        root,
        line: startLine,
        text: input.source.substring(startIndex, input.getCarret().index),
        nodeType: 'arrayExpression',
        elements,
        children: elements,
    };
}
