import { ASTRoot, EnumDeclaration, MessageDeclaration, ServiceDeclaration, ConstDeclaration, TypeAliasDeclaration, ASTNode } from '../parsing/ast/ast';

export function* iterateAst(node: ASTNode): IterableIterator<ASTNode> {
	yield node;
	for (const child of node.children) {
		yield* iterateAst(child);
	}
}

export function getDeclarations(astRoot: ASTRoot): Array<EnumDeclaration | MessageDeclaration | ServiceDeclaration | ConstDeclaration | TypeAliasDeclaration> {
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
