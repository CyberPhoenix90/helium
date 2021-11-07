import { existsSync } from 'fs';
import { resolve } from 'path';
import { ParsedArguments } from '../args/arg_parser';

export interface CompilerConfig {
	version: string;
	clientOut: TargetOutput[];
	serverOut: TargetOutput[];
	include: string[];
	links?: Record<string, string>;
}

export interface TargetOutput {
	namespace: string;
	path: string;
	platform: 'browser' | 'electron' | 'nodejs' | 'dotnet';
}

export interface Output {
	filePath: string;
	fileContent: string;
}

export function processCompilerConfig(args: ParsedArguments): CompilerConfig {
	const configFileName = args.map.p ?? args.map.project;
	if (!configFileName) {
		throw new Error('No project file specified');
	}

	const configFilePath = resolve(process.cwd(), configFileName.toString());

	if (!existsSync(configFilePath)) {
		throw new Error(`Project file ${configFilePath} does not exist`);
	}

	const config: CompilerConfig = require(configFilePath);

	if (!config.clientOut?.length && !config.serverOut?.length) {
		throw new Error('No output specified');
	}

	for (const clientOutput of config.clientOut ?? []) {
		validateOutputGeneric(clientOutput);
	}

	for (const serverOutput of config.serverOut ?? []) {
		validateOutputGeneric(serverOutput);
		if (serverOutput.platform === 'browser') {
			throw new Error('Browser platform is not supported for server');
		}
	}

	if (config.include.length === 0) {
		throw new Error('No source include specified');
	}

	return config;
}

function validateOutputGeneric(output: TargetOutput) {
	if (!output.namespace) {
		throw new Error('No namespace specified for output');
	}

	if (!output.path) {
		throw new Error('No path specified for  output');
	}

	if (!output.platform) {
		throw new Error('No platform specified for output');
	}

	if (!['browser', 'nodejs', 'dotnet', 'javascript', 'electron'].includes(output.platform)) {
		throw new Error(`Unknown platform ${output.platform} for output`);
	}
}
