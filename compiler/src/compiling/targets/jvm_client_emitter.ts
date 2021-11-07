import { Output } from '../../config/config';
import { Emitter, EmitterInput, ParsedFile } from '../emitter';

export class JVMClientEmitter extends Emitter {
	public emitModule(input: EmitterInput, resolveImport: (src: string, path: string) => ParsedFile): Output[] {
		throw new Error('Method not implemented.');
	}
}
