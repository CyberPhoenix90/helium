import { BuiltinType } from '../lexer';

export type Declarations =
    | EnumDeclaration
    | ConstDeclaration
    | MessageDeclaration
    | ServiceDeclaration
    | TypeAliasDeclaration
    | MessageMember
    | EnumMember
    | ServiceApiCall;

export interface ASTNode {
    root: ASTRoot;
    parent: ASTNode;
    children: ASTNode[];
    nodeType: string;
    line: number;
    character: number;
    text: string;
}

export interface ASTRoot extends ASTNode {
    statements: TopLevelStatement[];
    file: string;
}

export interface TopLevelStatement extends ASTNode {
    nodeType: 'import' | 'messageDeclaration' | 'constDeclaration' | 'enumDeclaration' | 'serviceDeclaration' | 'typeAliasDeclaration' | 'reexport';
}

export interface Reexport extends TopLevelStatement {
    nodeType: 'reexport';
    path: string;
    importSpecifiers: ImportSpecifier[];
}

export interface TypeAliasDeclaration extends TopLevelStatement {
    nodeType: 'typeAliasDeclaration';
    identifier: Identifier;
    type: TypeExpression;
    isExported: boolean;
}

export interface ServiceDeclaration extends TopLevelStatement {
    nodeType: 'serviceDeclaration';
    identifier: Identifier;
    apiCalls: ServiceApiCall[];
    constants: ConstDeclaration[];
    isClient: boolean;
    isExported: boolean;
}

export interface ServiceApiCall extends ASTNode {
    nodeType: 'serviceApiCall';
    protocol: string;
    identifier: Identifier;
    annotations: Annotation[];
    argument: TypeExpression;
    returnType: TypeExpression;
    errorType: TypeExpression;
}

export interface EnumDeclaration extends TopLevelStatement {
    nodeType: 'enumDeclaration';
    identifier: Identifier;
    isExported: boolean;
    members: EnumMember[];
}

export interface EnumMember extends ASTNode {
    nodeType: 'enumMember';
    identifier: Identifier;
    value: Literal;
}

export interface Expression extends ASTNode {
    nodeType: 'binaryExpression' | 'literal' | 'identifier' | 'callExpression' | 'arrayExpression';
}

export interface ArrayExpression extends Expression {
    nodeType: 'arrayExpression';
    elements: Expression[];
}

export interface BinaryExpression extends Expression {
    left: Expression;
    right: Expression;
    operation: string;
}
export interface TypeExpression extends ASTNode {
    nodeType: 'typeUnionExpression' | 'typeLiteralExpression' | 'identifier';
}

export interface TypeLiteral extends TypeExpression {
    nodeType: 'typeLiteralExpression';
    type: TypeReference | ArrayTypeReference;
}

export interface TypeUnionExpression extends TypeExpression {
    nodeType: 'typeUnionExpression';
    types: TypeLiteral[];
}

export interface CallExpression extends Expression {
    identifier: Identifier;
    arguments: Expression[];
    value: any;
}

export interface Literal extends Expression {
    type: string;
    value: any;
}

export interface Identifier extends Expression {
    value: string;
}

export interface Parameter extends ASTNode {
    nodeType: 'parameter';
    type: string;
    identifier: Identifier;
}

export interface ConstDeclaration extends TopLevelStatement {
    nodeType: 'constDeclaration';
    type: TypeExpression;
    identifier: Identifier;
    isExported: boolean;
    value: Expression;
}

export interface MessageDeclaration extends TopLevelStatement {
    identifier: Identifier;
    members: Array<MessageMember | OneOfMessageMember>;
    extends?: Identifier;
    isExported: boolean;
}

export interface OneOfMessageMember extends ASTNode {
    nodeType: 'oneOfMessageMember';
    fieldNumber: number;
    identifier: Identifier;
    subMembers: MessageMember[];
}

export interface MessageMember extends ASTNode {
    nodeType: 'messageMember';
    annotations: Annotation[];
    fieldNumber: number;
    identifier: Identifier;
    isOptional: boolean;
    defaultValue?: Expression;
    typeExpression: TypeExpression;
}

export interface Annotation extends ASTNode {
    nodeType: 'annotation';
    identifier: Identifier;
    arguments: Expression[];
}

export interface TypeReference extends ASTNode {
    nodeType: 'typeReference';
    identifier?: Identifier;
    typeArguments?: TypeExpression[];
    type?: BuiltinType;
}

export interface ArrayTypeReference extends ASTNode {
    nodeType: 'arrayTypeReference';
    type?: TypeLiteral;
}

export interface ImportStatement extends TopLevelStatement {
    nodeType: 'import';
    importSpecifiers: ImportSpecifier[];
    importedFilePath: string;
}

export interface ImportSpecifier extends ASTNode {
    nodeType: 'importSpecifier';
    originalName?: Identifier;
    identifier: Identifier;
}
