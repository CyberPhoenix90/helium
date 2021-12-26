import {
    ASTNode,
    ASTRoot,
    ConstDeclaration,
    Declarations,
    EnumDeclaration,
    Identifier,
    ImportStatement,
    MessageDeclaration,
    ServiceDeclaration,
    TypeAliasDeclaration,
} from '../parsing/ast/ast';
import { ParsedFile } from './emitter';

export function identifierToDeclaration(identifier: Identifier, resolveImport: (src: string, path: string) => ParsedFile): Declarations {
    for (const declaration of iterateDeclarationsThroughScope(identifier)) {
        if (declaration.identifier.value === identifier.value) {
            return declaration;
        }
    }

    for (const declaration of iterateImportedDeclarations(identifier.root, resolveImport)) {
        if (declaration.identifier.value === identifier.value) {
            return declaration;
        }
    }

    return undefined;
}

export function* iterateImportedDeclarations(ast: ASTRoot, resolveImport: (src: string, path: string) => ParsedFile): Iterable<Declarations> {
    for (const statement of ast.statements) {
        if (statement.nodeType === 'import') {
            const importedStuff = (statement as ImportStatement).importSpecifiers.map((specifier) => specifier.identifier.value);
            const res = resolveImport(ast.file, (statement as ImportStatement).importedFilePath);
            for (const declaration of getTopLevelDeclarations(res.ast)) {
                if (importedStuff.includes(declaration.identifier.value)) {
                    yield declaration;
                }
            }
        }
    }
}

export function* iterateDeclarationsThroughScope(startingScope: ASTNode): IterableIterator<Declarations> {
    let currentScope: ASTNode = startingScope.parent;
    while (currentScope) {
        for (const child of currentScope.children) {
            if (
                child.nodeType === 'constDeclaration' ||
                child.nodeType === 'enumDeclaration' ||
                child.nodeType === 'messageDeclaration' ||
                child.nodeType === 'serviceDeclaration' ||
                child.nodeType === 'typeAliasDeclaration' ||
                child.nodeType === 'messageMember' ||
                child.nodeType === 'enumMember' ||
                child.nodeType === 'serviceApiCall'
            ) {
                yield child as any;
            }
        }
        currentScope = currentScope.parent;
    }
}

export function* iterateAST(startingNode: ASTNode): IterableIterator<ASTNode> {
    let currentNode: ASTNode = startingNode;
    yield currentNode;
    for (const child of currentNode.children) {
        yield* iterateAST(child);
    }
}

export function getTopLevelDeclarations(
    astRoot: ASTRoot
): Array<EnumDeclaration | MessageDeclaration | ServiceDeclaration | ConstDeclaration | TypeAliasDeclaration> {
    const declarations: Array<EnumDeclaration | MessageDeclaration | ServiceDeclaration | ConstDeclaration | TypeAliasDeclaration> = [];
    for (const statement of astRoot.statements) {
        switch (statement.nodeType) {
            case 'enumDeclaration':
                declarations.push(statement as EnumDeclaration);
                break;
            case 'messageDeclaration':
                declarations.push(statement as MessageDeclaration);
                break;
            case 'serviceDeclaration':
                declarations.push(statement as ServiceDeclaration);
                break;
            case 'constDeclaration':
                declarations.push(statement as ConstDeclaration);
                break;
            case 'typeAliasDeclaration':
                declarations.push(statement as TypeAliasDeclaration);
                break;
        }
    }
    return declarations;
}
