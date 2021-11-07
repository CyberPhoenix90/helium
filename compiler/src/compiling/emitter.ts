import { ASTRoot } from '../parsing/ast/ast';
import { CompilerConfig, Output, TargetOutput } from '../config/config';

export abstract class Emitter {
	public abstract emitModule(input: EmitterInput, resolveImport: (src: string, path: string) => ParsedFile): Output[];
}

export interface ParsedFile {
	path: string;
	ast: ASTRoot;
}

export interface EmitterInput {
	cwd: string;
	outDir: string;
	config: CompilerConfig;
	emitConfig: TargetOutput;
	files: ParsedFile[];
}
