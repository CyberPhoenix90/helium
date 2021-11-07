import { join, parse, relative } from 'path';
import { Output } from '../../config/config';
import {
	ArrayExpression,
	ArrayTypeReference,
	BinaryExpression,
	ConstDeclaration,
	EnumDeclaration,
	Expression,
	Identifier,
	ImportSpecifier,
	ImportStatement,
	Literal,
	MessageDeclaration,
	MessageMember,
	OneOfMessageMember,
	ServiceApiCall,
	ServiceDeclaration,
	TypeAliasDeclaration,
	TypeExpression,
	TypeLiteral,
	TypeReference,
	TypeUnionExpression
} from '../../parsing/ast/ast';
import { BuiltinType } from '../../parsing/lexer';
import { getDeclarations } from '../../utils/ast_utils';
import { Emitter, EmitterInput, ParsedFile } from '../emitter';
import { emitPackageJson } from './js_shared/emit_packagejson';

export class JsClientEmitter extends Emitter {
	private input: EmitterInput;
	private resolveImport: (src: string, path: string) => ParsedFile;

	public emitModule(input: EmitterInput, resolveImport: (src: string, path: string) => ParsedFile): Output[] {
		this.input = input;
		this.resolveImport = resolveImport;

		const jsOutput: Output = {
			fileContent: '',
			filePath: join(input.outDir, input.emitConfig.namespace + '.js')
		};

		const dtsOutput: Output = {
			fileContent: '',
			filePath: join(input.outDir, input.emitConfig.namespace + '.d.ts')
		};

		jsOutput.fileContent = this.emitJs(input);
		dtsOutput.fileContent = this.emitDts(input);

		return [jsOutput, dtsOutput, emitPackageJson(input)];
	}

	private emitJs(input: EmitterInput): string {
		const lines = [
			`(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports, require('helium_client_rt'));
        if (v !== undefined) module.exports = v;
    } else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "helium_client_rt"], factory);
    }
})(function (require, exports, helium_client_rt) {
	const __ns = \`${this.input.emitConfig.namespace}\`;\n`
		];

		for (const file of input.files) {
			lines.push(this.emitFile(file));
		}

		lines.push(`\n});`);
		return lines.join('\n');
	}

	private emitFile(file: ParsedFile): string {
		const lines = [];
		for (const statement of file.ast.statements) {
			if (statement.nodeType === 'serviceDeclaration' && (statement as ServiceDeclaration).isExported) {
				lines.push(this.emitService(statement as ServiceDeclaration, false));
			} else if (statement.nodeType === 'enumDeclaration' && (statement as EnumDeclaration).isExported) {
				lines.push(this.emitEnum(statement as EnumDeclaration, false));
			} else if (statement.nodeType === 'constDeclaration' && (statement as ConstDeclaration).isExported) {
				lines.push(this.emitConstDeclaration(statement as ConstDeclaration, false));
			} else if (statement.nodeType === 'messageDeclaration' && (statement as MessageDeclaration).isExported) {
				lines.push(this.emitMessageFactory(statement as MessageDeclaration));
			}
		}
		return lines.join('\n');
	}

	private emitMessageFactory(ast: MessageDeclaration): string {
		return `	exports.${ast.identifier.value}Factory = {
        validate() {

		},
		fromBinary(binaryReader) {
			const result = {};
			${this.emitMessageFactoryFromBinary(ast)}
			exports.${ast.identifier.value}Factory.validate(result);
			return result;
		},
		toBinary(message, binaryWriter) {
			${this.emitMessageFactoryToBinary(ast)}
		},
		fromJson(json) {
			return ${ast.identifier.value}Factory.createInstance(JSON.parse(json));
		},
		toJson(message) {
			return JSON.stringify(message);
		},
		createInstance(message) {
			${ast.identifier.value}Factory.validate(message);
			return message;
		}
	};\n`;
	}

	private emitMessageFactoryToBinary(ast: MessageDeclaration): string {
		const lines = [];
		for (const member of ast.members.sort((a, b) => a.fieldNumber - b.fieldNumber)) {
			if (member.nodeType === 'oneOfMessageMember') {
				lines.push(this.emitOneOfMessageMemberToBinary(member as OneOfMessageMember));
			} else {
				lines.push(this.emitMessageMemberToBinary(member));
			}
		}
		return lines.join('\n');
	}

	private emitMessageFactoryFromBinary(ast: MessageDeclaration): string {
		const lines = [];
		for (const member of ast.members.sort((a, b) => a.fieldNumber - b.fieldNumber)) {
			if (member.nodeType === 'messageMember') {
				lines.push(this.emitMessageMemberFromBinary(member as MessageMember));
			} else if (member.nodeType === 'oneOfMessageMember') {
				lines.push(this.emitOneOfMessageMemberFromBinary(member as OneOfMessageMember));
			}
		}
		return lines.join('\n');
	}

	private emitMessageMemberFromBinary(ast: MessageMember): string {
		const lines = [];
		const typeExpression = ast.typeExpression;

		if (typeExpression.nodeType === 'typeUnionExpression') {
			throw new Error('Union types are not yet implemented');
		}
		if (typeExpression.nodeType === 'typeLiteralExpression') {
			const typeReference = (typeExpression as TypeLiteral).type;
			const isArray = typeReference.nodeType === 'arrayTypeReference';
			const typeValue = isArray ? (typeReference as ArrayTypeReference).type.type : typeReference;

			if (typeValue.nodeType === 'arrayTypeReference') {
				throw new Error('Nested Array types are not yet implemented');
			}

			if (isArray) {
				if (typeValue.type === 'byte') {
					lines.push(this.emitReadIfExists(ast, () => `result.${ast.identifier.value} = binaryReader.readBytes(binaryReader.readUInt32());`));
				} else {
					lines.push(
						this.emitReadIfExists(ast, () => {
							const tmp = [];
							tmp.push(`result.${ast.identifier.value} = [];`);
							tmp.push(`const len = binaryReader.readUInt32();`);
							tmp.push(`for(let i = 0; i < len; i++) {`);
							tmp.push(this.emitReadType(typeValue, `result.${ast.identifier.value}.push(`) + ');');
							tmp.push(`}`);
							return tmp.join('\n');
						})
					);
				}
			} else {
				lines.push(this.emitReadIfExists(ast, () => this.emitReadType(typeValue, `result.${ast.identifier.value} = `)));
			}
		}

		return lines.join('\n');
	}

	private emitMessageMemberToBinary(ast: MessageMember): string {
		const lines = [];
		const typeExpression = ast.typeExpression;

		if (typeExpression.nodeType === 'typeUnionExpression') {
			throw new Error('Union types are not yet implemented');
		}
		if (typeExpression.nodeType === 'typeLiteralExpression') {
			const typeReference = (typeExpression as TypeLiteral).type;
			const isArray = typeReference.nodeType === 'arrayTypeReference';
			const typeValue = isArray ? (typeReference as ArrayTypeReference).type.type : typeReference;

			if (typeValue.nodeType === 'arrayTypeReference') {
				throw new Error('Nested Array types are not yet implemented');
			}

			if (isArray) {
				if (typeValue.type === 'byte') {
					lines.push(
						this.emitWriteIfExists(ast, `message.${ast.identifier.value}`, () => {
							return `binaryWriter.writeBytes(message.${ast.identifier.value});`;
						})
					);
				} else {
					lines.push(
						this.emitWriteIfExists(ast, `message.${ast.identifier.value}`, () => {
							const tmp = [];
							tmp.push(`binaryWriter.writeUInt32(message.${ast.identifier.value}.length);`);
							tmp.push(`for(let i = 0; i < message.${ast.identifier.value}.length; i++) {`);
							tmp.push(this.emitWriteType(typeValue, `message.${ast.identifier.value}[i]`));
							tmp.push(`}`);

							return tmp.join('\n');
						})
					);
				}
			} else {
				lines.push(
					this.emitWriteIfExists(ast, `message.${ast.identifier.value}`, () => this.emitWriteType(typeValue, `message.${ast.identifier.value}`))
				);
			}
		}

		return lines.join('\n');
	}

	private emitWriteIfExists(type: MessageMember, value: string, onExists?: () => string, onNotExists?: () => string): string {
		if (type.isOptional) {
			// 255 = absent
			// 0 - 254 = type union index
			return `if(${value} == undefined) {
				binaryWriter.writeByte(255);
				${onNotExists ? onNotExists() : ''}
			} else {
				binaryWriter.writeByte(0);
				${onExists ? onExists() : ''}
			}`;
		} else {
			return onExists?.() ?? '';
		}
	}

	private emitReadIfExists(type: MessageMember, onExists?: () => string, onNotExists?: () => string): string {
		if (type.isOptional) {
			// 255 = absent
			// 0 - 254 = type union index
			return `if(binaryReader.readByte() == 255) {
				${onNotExists ? onNotExists() : ''}
			} else {
				${onExists ? onExists() : ''}
			}`;
		} else {
			return onExists?.() ?? '';
		}
	}

	private emitWriteType(type: TypeReference, value: string): string {
		switch (type.type) {
			case 'boolean':
				return `binaryWriter.writeBoolean(${value});`;
			case 'int':
				return `binaryWriter.writeInt32(${value});`;
			case 'uint':
				return `binaryWriter.writeUInt32(${value});`;
			case 'long':
				return `binaryWriter.writeInt64(${value});`;
			case 'ulong':
				return `binaryWriter.writeUInt64(${value});`;
			case 'float':
				return `binaryWriter.writeFloat32(${value});`;
			case 'double':
				return `binaryWriter.writeFloat64(${value});`;
			case 'string':
				return `binaryWriter.writeString(${value});`;
			case 'byte':
				return `binaryWriter.writeByte(${value});`;
			default:
				throw new Error(`Unknown type ${type.type}`);
		}
	}

	private emitOneOfMessageMemberFromBinary(ast: OneOfMessageMember): string {
		return '';
	}

	private emitOneOfMessageMemberToBinary(ast: OneOfMessageMember): string {
		return '';
	}

	private emitReadType(typeValue: TypeReference, prefix: string): string {
		switch (typeValue.type) {
			case 'string':
				return `${prefix}binaryReader.readString()`;
			case 'int':
				return `${prefix}binaryReader.readInt32()`;
			case 'uint':
				return `${prefix}binaryReader.readUInt32()`;
			case 'short':
				return `${prefix}binaryReader.readInt16()`;
			case 'ushort':
				return `${prefix}binaryReader.readUInt16()`;
			case 'long':
				return `${prefix}binaryReader.readInt64()`;
			case 'ulong':
				return `${prefix}binaryReader.readUInt64()`;
			case 'float':
				return `${prefix}binaryReader.readFloat32()`;
			case 'double':
				return `${prefix}binaryReader.readFloat64()`;
			case 'boolean':
				return `${prefix}binaryReader.readBoolean()`;
			case 'byte':
				return `${prefix}binaryReader.readByte()`;
			default:
				throw new Error(`Unsupported type ${typeValue.type} in ${typeValue.text}`);
		}
	}

	private emitMessageFactoryDts(ast: MessageDeclaration): string {
		return `	export const ${ast.identifier.value}Factory:HeliumMessageFactory<${ast.identifier.value}>;`;
	}

	private emitDts(input: EmitterInput): string {
		const lines = [];

		lines.push(`
		declare interface ValidationError<P, T> {
			/**
			 * Nature of the error
			 */
			violation: string;
			/**
			 * The property that caused the error
			 */
			field: string;
			/**
			 * The message containing the invalid value
			 */
			offendingMessage: T;
			/**
			 * The message that was validated
			 */
			validationRootMessage: P;
			/**
			 * Full path to the property that caused the error
			 */
			fullyQualifiedFieldName: string;
		}


		declare type HeliumMessageFactory<T> = {
			validate(msg: T): ValidationError<T, any>[];
			fromBinary(binaryReader: BinaryReader): T;
			toBinary(message: T, writer: BinaryWriter): ArrayBuffer;
			fromJSON(json: string): T;
			toJSON(message: T): string;
			/**
			 * Allows you to create a new instance where all the defaults are filled in and the state is validated
			 */
			createInstance(instance: T): T;
		};

		declare interface BinaryWriter {
			writeBoolean(value: boolean): void;
			writeByte(value: number): void;
			writeInt16(value: number): void;
			writeInt32(value: number): void;
			writeInt64(value: number): void;
			writeFloat32(value: number): void;
			writeFloat64(value: number): void;
			writeString(value: string): void;
			writeUInt32(value: number): void;
			writeUInt64(value: number): void;
			writeBytes(value: Uint8Array): void;
			writeBase64(value: string): void;
			toArrayBuffer(): ArrayBuffer;
			reset():void;
		}
		declare interface BinaryReader {
			readonly offset: number;
			readByte(): number;
			readInt16(): number;
			readInt32(): number;
			readInt64(): number;
			readUInt16(): number;
			readUInt32(): number;
			readFloat32(): number;
			readFloat64(): number;
			readString(): string;
			readBytes(length: number): Uint8Array;
			readBoolean(): boolean;
			readDate(): Date;
		}

		`);
		for (const file of input.files) {
			lines.push([`declare module "${this.createNamespace(file.path)}" {`]);
			lines.push(...this.emitDtsFile(file));
			lines.push('}');
			lines.push('');
		}

		lines.push([`declare module "${input.emitConfig.namespace}" {`]);
		for (const file of input.files) {
			const declarations = getDeclarations(file.ast);
			for (const declaration of declarations) {
				if (declaration.isExported) {
					lines.push(`    ${this.emitExported(declaration, true)}{ ${declaration.identifier.value} } from "${this.createNamespace(file.path)}";`);
					if (declaration.nodeType === 'messageDeclaration') {
						lines.push(
							`    ${this.emitExported(declaration, true)}{ ${declaration.identifier.value}Factory } from "${this.createNamespace(file.path)}";`
						);
					}
				}
			}
		}
		lines.push('}');

		return lines.join('\n');
	}

	private createNamespace(filePath: string): string {
		return `${this.input.emitConfig.namespace}/${relative(this.input.cwd, join(parse(filePath).dir, parse(filePath).name))}`;
	}

	private emitDtsFile(file: ParsedFile): string[] {
		const lines = [];
		for (const statement of file.ast.statements) {
			switch (statement.nodeType) {
				case 'enumDeclaration':
					lines.push(this.emitEnum(statement as EnumDeclaration, true));
					break;
				case 'constDeclaration':
					lines.push(this.emitConstDeclaration(statement as ConstDeclaration, true));
					break;
				case 'messageDeclaration':
					lines.push(this.emitMessageDeclaration(statement as MessageDeclaration));
					lines.push(this.emitMessageFactoryDts(statement as MessageDeclaration));
					break;
				case 'typeAliasDeclaration':
					lines.push(this.emitTypeAlias(statement as TypeAliasDeclaration));
					break;
				case 'serviceDeclaration':
					lines.push(this.emitService(statement as ServiceDeclaration, true));
					break;
				case 'import':
					lines.push(this.emitImport(statement as ImportStatement, true));
					break;
			}
		}
		return lines;
	}

	private emitImport(ast: ImportStatement, dts: boolean): string {
		return `	import { ${this.emitImportSpecifiers(ast.importSpecifiers)} } from "${this.createNamespace(
			this.resolveImport(ast.root.file, ast.importedFilePath).path
		)}";`;
	}

	private emitImportSpecifiers(ast: ImportSpecifier[]): string {
		return ast
			.map((specifier) => (specifier.originalName ? `${specifier.originalName.value} as ${specifier.identifier.value}` : specifier.identifier.value))
			.join(', ');
	}

	private emitService(ast: ServiceDeclaration, dts: boolean): string {
		const serviceName = ast.identifier.value;

		if (dts) {
			return (
				`${this.emitExported(ast, dts)}class ${ast.identifier.value} \n{` +
				`${ast.constants.map((constant) => this.emitServiceConstant(constant, dts)).join('\n')}\n` +
				`${ast.apiCalls.map((call) => this.emitServiceApiCall(serviceName, call, dts)).join('\n')}\n` +
				`	}`
			);
		} else {
			return (
				`class ${ast.identifier.value} {\n` +
				`${ast.constants.map((constant) => this.emitServiceConstant(constant, dts)).join('\n')}\n` +
				`${ast.apiCalls.map((call) => this.emitServiceApiCall(serviceName, call, dts)).join('\n')}\n` +
				`	}\n` +
				`exports.${ast.identifier.value} = ${ast.identifier.value};\n`
			);
		}
	}

	private emitServiceConstant(constant: ConstDeclaration, dts: boolean): string {
		return `	${dts ? `public ` : ``}static ${dts ? `readonly ` : ``} ${this.emitIdentifier(constant.identifier)}${
			dts ? `: ${this.emitTypeExpression(constant.type)}` : ''
		} ${dts ? '' : ` = ${this.emitExpression(constant.value)}`};`;
	}

	private emitServiceApiCall(serviceName: string, call: ServiceApiCall, dts: boolean): string {
		const callArg = this.emitTypeExpression(call.argument);

		return `	${dts ? `public ` : ``}static ${this.emitIdentifier(call.identifier)}(${callArg !== 'void' ? `body${dts ? `: ${callArg}` : ''}` : ''})${
			dts
				? `:Promise<{response?: ${this.emitTypeExpression(call.returnType)}, error?: ${
						call.errorType ? this.emitTypeExpression(call.errorType) : 'Error'
				  }}>`
				: this.emitApiCallImplementation(serviceName, call)
		}`;
	}

	private emitApiCallImplementation(serviceName: string, call: ServiceApiCall) {
		return `{
			${
				call.argument.nodeType === 'typeUnionExpression' || (call.argument as TypeLiteral).type.type !== 'void'
					? this.emitPostCall(serviceName, call)
					: this.emitGetCall(serviceName, call)
			}
		}`;
	}

	private emitGetCall(serviceName: string, call: ServiceApiCall): string {
		return `helium_client_rt.heliumHttpget(\`${serviceName}\`, \`${call.identifier.value}\`, __ns);`;
	}

	private emitPostCall(serviceName: string, call: ServiceApiCall): string {
		return `helium_client_rt.heliumHttpPost(\`${serviceName}\`, \`${call.identifier.value}\`, __ns, body);`;
	}

	private emitTypeAlias(ast: TypeAliasDeclaration): string {
		return `	${this.emitExported(ast, true)}type ${ast.identifier.value} = ${this.emitTypeExpression(ast.type)};`;
	}

	private emitMessageDeclaration(ast: MessageDeclaration): string {
		return `	${this.emitExported(ast, true)}interface ${ast.identifier.value}${this.emitExtends(ast.extends)} {
		${ast.members.map((member) => this.emitMessageMember(member)).join('\n')}
	}`;
	}

	private emitExtends(ext: Identifier[]): string {
		if (!ext?.length) {
			return '';
		} else {
			return ` extends ${ext.map(this.emitLiteral.bind(this)).join(', ')}`;
		}
	}

	private emitMessageMember(member: MessageMember | OneOfMessageMember): string {
		if (member.nodeType === 'oneOfMessageMember') {
			return `${member.identifier.value}: { ${this.emitOneOfMessageMember(member as OneOfMessageMember)} };`;
		} else {
			return `${member.identifier.value}${this.emitOptional(member.isOptional)}: ${this.emitTypeExpression(member.typeExpression)};`;
		}
	}

	private emitOneOfMessageMember(member: OneOfMessageMember): string {
		return member.subMembers.map((subMember) => `${subMember.identifier.value}?: ${this.emitTypeExpression(subMember.typeExpression)}`).join(';\n');
	}

	private emitOptional(isOptional: boolean): string {
		return isOptional ? '?' : '';
	}

	private emitConstDeclaration(ast: ConstDeclaration, dts: boolean): string {
		return `	${this.emitExported(ast, dts)}${dts ? 'const ' : ''}${ast.identifier.value}${dts ? `: ${this.emitTypeExpression(ast.type)}` : ''}${
			dts ? '' : ` = ${this.emitExpression(ast.value)};`
		}`;
	}

	private emitTypeExpression(type: TypeExpression): string {
		switch (type.nodeType) {
			case 'typeUnionExpression':
				return this.emitTypeUnionExpression(type as TypeUnionExpression);
			case 'typeLiteralExpression':
				return this.emitTypeLiteralExpression(type as TypeLiteral);
			default:
				throw new Error(`Unknown type expression ${type.nodeType}`);
		}
	}

	private emitTypeUnionExpression(type: TypeUnionExpression): string {
		return `(${type.types.map((t) => this.emitTypeLiteralExpression(t)).join(' | ')})`;
	}

	private emitTypeLiteralExpression(type: TypeLiteral): string {
		switch (type.type.nodeType) {
			case 'typeReference':
				return this.emitTypeReference(type.type as TypeReference);
			case 'arrayTypeReference':
				return this.emitArrayTypeReference(type.type as ArrayTypeReference);
		}
	}

	private emitTypeReference(type: TypeReference): string {
		return `${type.identifier ? this.emitIdentifier(type.identifier) : this.emitBuiltInType(type.type)}${this.emitTypeArguments(type.typeArguments)}`;
	}

	private emitBuiltInType(type: BuiltinType): string {
		switch (type) {
			case 'byte':
			case 'short':
			case 'int':
			case 'long':
			case 'ushort':
			case 'uint':
			case 'ulong':
			case 'float':
			case 'double':
				return 'number';
			case 'boolean':
				return 'boolean';
			case 'string':
				return 'string';
			case 'date':
				return 'Date';
			case 'set':
				return 'Set';
			case 'map':
				return 'Map';
			case 'void':
				return 'void';
		}
	}

	private emitArrayTypeReference(type: ArrayTypeReference): string {
		return `${this.emitTypeLiteralExpression(type.type)}[]`;
	}

	private emitTypeArguments(typeArguments: TypeExpression[]): string {
		if (!typeArguments?.length) {
			return '';
		} else {
			return `<${typeArguments.map(this.emitTypeExpression.bind(this)).join(', ')}>`;
		}
	}

	private emitExpression(value: Expression) {
		switch (value.nodeType) {
			case 'binaryExpression':
				return this.emitBinaryExpression(value as BinaryExpression);
			case 'literal':
				return this.emitLiteral(value as Literal);
			case 'identifier':
				return this.emitIdentifier(value as Identifier);
			case 'arrayExpression':
				return this.emitArrayExpression(value as ArrayExpression);
		}
	}

	private emitArrayExpression(value: ArrayExpression): string {
		return `[${value.elements.map((e) => this.emitExpression(e)).join(', ')}]`;
	}

	private emitIdentifier(identifier: Identifier): string {
		return identifier.value;
	}

	private emitBinaryExpression(expression: BinaryExpression): string {
		return `${this.emitExpression(expression.left)} ${expression.operation} ${this.emitExpression(expression.right)}`;
	}

	private emitEnum(ast: EnumDeclaration, dts: boolean): string {
		if (dts) {
			return `${this.emitExported(ast, dts)} enum ${ast.identifier.value} {
${ast.members.map((m) => `    ${m.identifier.value} = ${this.emitLiteral(m.value)}`).join(',\n')}
}\n`;
		} else {
			return `	exports.${ast.identifier.value} = {
${ast.members.map((m) => `	    ${m.identifier.value}: ${this.emitLiteral(m.value)}`).join(',\n')}
	}\n`;
		}
	}

	private emitExported(ast: { isExported: boolean }, dts: boolean) {
		return ast.isExported ? (dts ? 'export ' : 'exports.') : '';
	}

	private emitLiteral(value: Literal): string {
		switch (value.type) {
			case 'string':
				return `"${value.value}"`;
			case 'boolean':
				return value.value ? 'true' : 'false';
			default:
				return value.value;
		}
	}
}
