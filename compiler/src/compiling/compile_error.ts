import { ASTNode } from '../parsing/ast/ast';

export class CompileError extends Error {
	constructor(astNode: ASTNode, message: string, causedBy?: Error) {
		let cause = '';
		if (causedBy) {
			cause = `\nCaused By: ${causedBy.message}`;
		}
		super(`${astNode.root.file}:${astNode.line}:${astNode.character} - error ${message}${cause}`);
	}
}
