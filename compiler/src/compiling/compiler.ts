import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { match } from 'minimatch';
import { isAbsolute, join, parse } from 'path';
import { CompilerConfig, Output } from '../config/config';
import { InputStream } from '../parsing/input';
import { lexer } from '../parsing/lexer';
import { parser } from '../parsing/parser';
import { Emitter, ParsedFile } from './emitter';
import { JsClientEmitter } from './targets/js_client_emitter';
import { CILClientEmitter } from './targets/cil_client_emitter';
import { JVMClientEmitter } from './targets/jvm_client_emitter';
import { JsServerEmitter } from './targets/js_server_emitter';
import { validate } from './validator';

export class Compiler {
	private cwd: string;
	private config: CompilerConfig;
	private compileSession: Record<string, ParsedFile> = {};
	private projectContent: ParsedFile[];

	constructor(cwd: string, config: CompilerConfig) {
		this.cwd = cwd;
		this.config = config;
		let files: string[] = [];
		let base = '';
		for (const inc of config.include) {
			const pieces = inc.split('/');
			while (pieces.length > 0 && !pieces[0].includes('*')) {
				if (pieces[0] !== '') {
					base = join(base, pieces.shift());
				}
			}
			if (base || pieces.length) {
				const pattern = pieces.join('/');
				const dirOrFile = join(cwd, base);
				if (existsSync(dirOrFile)) {
					if (statSync(dirOrFile).isDirectory()) {
						const candidates = readDirRecursive(dirOrFile);
						const matches = match(candidates, pattern);
						files.push(...matches);
					} else if (pieces.length === 0) {
						files.push(dirOrFile);
					}
				}
			}
		}

		for (const file of files) {
			const source = readFileSync(file, 'utf8');
			const ast = parser(lexer(new InputStream(source, file)));
			this.compileSession[file] = {
				path: file,
				ast: ast
			};
		}

		this.projectContent = Object.values(this.compileSession);
	}

	public validate(): void {
		validate(this.projectContent, this.config, this.resolveImport.bind(this));
	}

	public emit(): void {
		const output: Output[] = [];
		for (const clientOut of this.config.clientOut) {
			let targetDir: string;
			if (isAbsolute(clientOut.path)) {
				targetDir = clientOut.path;
			} else {
				targetDir = join(this.cwd, clientOut.path);
			}

			if (!existsSync(targetDir)) {
				mkdirSync(targetDir, {
					recursive: true
				});
			}

			const emitter: Emitter = getEmitter(clientOut.platform, true);
			output.push(
				...emitter.emitModule(
					{
						cwd: this.cwd,
						outDir: targetDir,
						emitConfig: clientOut,
						config: this.config,
						files: this.projectContent
					},
					this.resolveImport.bind(this)
				)
			);
		}
		for (const serverOut of this.config.serverOut) {
			let targetDir: string;
			if (isAbsolute(serverOut.path)) {
				targetDir = serverOut.path;
			} else {
				targetDir = join(this.cwd, serverOut.path);
			}

			if (!existsSync(targetDir)) {
				mkdirSync(targetDir, {
					recursive: true
				});
			}

			const emitter: Emitter = getEmitter(serverOut.platform, false);
			output.push(
				...emitter.emitModule(
					{
						cwd: this.cwd,
						outDir: targetDir,
						emitConfig: serverOut,
						config: this.config,
						files: this.projectContent
					},
					this.resolveImport.bind(this)
				)
			);
		}

		for (const out of output) {
			writeFileSync(out.filePath, out.fileContent);
		}
	}

	private resolveImport(src: string, path: string): ParsedFile {
		if (src.endsWith('.he')) {
			src = parse(src).dir;
		}

		const pieces = path.split('/');
		if (!pieces[pieces.length - 1].includes('.')) {
			path += '.he';
		}

		let file: string;
		if (this.config.links && this.config.links[path]) {
			file = this.config.links[path];
		}

		if (!file) {
			file = join(src, path);
		} else if (file.startsWith('.')) {
			file = join(src, file);
		}

		if (!this.compileSession[file]) {
			const source = readFileSync(file, 'utf8');
			this.compileSession[file] = {
				path: file,
				ast: parser(lexer(new InputStream(source, file)))
			};
		}

		return this.compileSession[file];
	}
}

function getEmitter(platform: string, client: boolean): Emitter {
	if (client) {
		switch (platform) {
			case 'node':
			case 'nodejs':
			case 'browser':
			case 'javascript':
			case 'electron':
				return new JsClientEmitter();
			case 'cil':
				return new CILClientEmitter();
			case 'jvm':
				return new JVMClientEmitter();
		}
	} else {
		switch (platform) {
			case 'node':
			case 'nodejs':
			case 'electron':
			case 'javascript':
				return new JsServerEmitter();
		}
	}

	throw new Error(`Unknown platform: ${platform} ${client ? ' for client output' : ' for server output'}`);
}

function readDirRecursive(path: string): string[] {
	const files = [];
	const list = readdirSync(path);
	for (const file of list) {
		const filePath = join(path, file);
		if (statSync(filePath).isDirectory()) {
			files.push(...readDirRecursive(filePath));
		} else {
			files.push(filePath);
		}
	}
	return files;
}
