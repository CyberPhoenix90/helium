import { join } from 'path';
import { Output } from '../../config/config';
import { Emitter, EmitterInput, ParsedFile } from '../emitter';
import { emitPackageJson } from './js_shared/emit_packagejson';

export class JsServerEmitter extends Emitter {
	public emitModule(input: EmitterInput, resolveImport: (src: string, path: string) => ParsedFile): Output[] {
		const jsOutput: Output = {
			fileContent: '',
			filePath: join(input.outDir, input.emitConfig.namespace + '.js')
		};

		const dtsOutput: Output = {
			fileContent: '',
			filePath: join(input.outDir, input.emitConfig.namespace + '.d.ts')
		};

		for (const file of input.files) {
			jsOutput.fileContent +=
				JSON.stringify(
					file.ast,
					(key: string, value: any) => {
						if (key === 'root') {
							return undefined;
						} else {
							return value;
						}
					},
					4
				) + '\n';
		}

		return [jsOutput, dtsOutput, emitPackageJson(input)];
	}
}
