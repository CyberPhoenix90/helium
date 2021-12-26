import { CompilerConfig } from '../config/config';
import { ASTNode, Identifier, ImportStatement, MessageDeclaration, MessageMember, OneOfMessageMember } from '../parsing/ast/ast';
import { getTopLevelDeclarations, identifierToDeclaration, iterateAST } from './ast_helper';
import { CompileError } from './compile_error';
import { ParsedFile } from './emitter';

export function validate(input: ParsedFile[], compilerConfig: CompilerConfig, resolveImport: (src: string, path: string) => ParsedFile): ParsedFile[] {
    for (const file of input) {
        validateFile(file, compilerConfig, resolveImport);
    }

    return input;
}

export function validateFile(file: ParsedFile, compilerConfig: CompilerConfig, resolveImport: (src: string, path: string) => ParsedFile): void {
    const { ast, path } = file;

    validateIdentifiers(ast, resolveImport);

    for (const statement of ast.statements) {
        switch (statement.nodeType) {
            case 'messageDeclaration':
                validateMessageDeclaration(statement as MessageDeclaration, compilerConfig, resolveImport);
                break;
            case 'import':
                try {
                    const res = resolveImport(path, (statement as ImportStatement).importedFilePath);
                    const { importSpecifiers } = statement as ImportStatement;
                    const declarations = getTopLevelDeclarations(res.ast);
                    for (const importSpecifier of importSpecifiers) {
                        const importee = declarations.find((d) => d.identifier.value === (importSpecifier.originalName ?? importSpecifier.identifier).value);
                        if (!importee) {
                            throw new CompileError(
                                importSpecifier,
                                `Could not find imported member ${(importSpecifier.originalName ?? importSpecifier.identifier).value}`
                            );
                        }
                        if (!importee.isExported) {
                            throw new CompileError(importSpecifier, `${importee.identifier.value} is not exported`);
                        }
                    }
                } catch (e) {
                    throw new CompileError(statement, `Failed to resolve import`, e);
                }
                break;
        }
    }
}

function validateIdentifiers(ast: ASTNode, resolveImport: (src: string, path: string) => ParsedFile): void {
    for (const node of iterateAST(ast)) {
        if (node.nodeType === 'identifier') {
            if (['importSpecifier', 'annotation'].includes(node.parent.nodeType)) {
                continue;
            }

            const declaration = identifierToDeclaration(node as Identifier, resolveImport);
            if (!declaration) {
                throw new CompileError(node, `Could not find declaration for Identifier ${(node as Identifier).value}`);
            }
        }
    }
}

function validateMessageDeclaration(message: MessageDeclaration, compilerConfig: CompilerConfig, resolveImport: (src: string, path: string) => ParsedFile) {
    const { members } = message;
    validateMessages(members);
}

function validateMessages(members: Array<MessageMember | OneOfMessageMember>): void {
    let fieldSet = new Set<number>();

    for (const member of members) {
        if (fieldSet.has(member.fieldNumber)) {
            throw new CompileError(member, `Field number ${member.fieldNumber} is already used`);
        } else {
            fieldSet.add(member.fieldNumber);
        }
        if (member.nodeType === 'oneOfMessageMember') {
            validateMessages(member.subMembers);
        }
    }
}
