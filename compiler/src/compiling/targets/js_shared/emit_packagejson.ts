import { join } from 'path';
import { Output } from '../../../config/config';
import { EmitterInput } from '../../emitter';

export function emitPackageJson(input: EmitterInput): Output {
	const result: Output = {
		filePath: join(input.outDir, 'package.json'),
		fileContent: JSON.stringify(
			{
				name: input.emitConfig.namespace,
				version: input.config.version,
				main: join(input.outDir, input.emitConfig.namespace + '.js'),
				typings: join(input.outDir, input.emitConfig.namespace + '.d.ts')
			},
			null,
			4
		)
	};

	return result;
}
