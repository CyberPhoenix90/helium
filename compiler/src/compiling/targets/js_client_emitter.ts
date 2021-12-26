import { join, parse, relative } from 'path';
import { Output } from '../../config/config';
import {
    ConstDeclaration,
    EnumDeclaration,
    ImportSpecifier,
    ImportStatement,
    MessageDeclaration,
    ServiceApiCall,
    ServiceDeclaration,
    TypeAliasDeclaration,
    TypeExpression,
    TypeLiteral,
} from '../../parsing/ast/ast';
import { getTopLevelDeclarations } from '../ast_helper';
import { Emitter, EmitterInput, ParsedFile } from '../emitter';
import { emitConstDeclaration, emitEnum } from './js_shared/emit_enum';
import { emitExpression, emitIdentifier, emitTypeExpression } from './js_shared/emit_expression';
import { emitExported, emitMessageDeclaration, emitMessageFactory, emitMessageFactoryDts } from './js_shared/emit_message';
import { emitPackageJson } from './js_shared/emit_packagejson';

export class JsClientEmitter extends Emitter {
    private input: EmitterInput;
    private resolveImport: (src: string, path: string) => ParsedFile;

    public emitModule(input: EmitterInput, resolveImport: (src: string, path: string) => ParsedFile): Output[] {
        this.input = input;
        this.resolveImport = resolveImport;

        const jsOutput: Output = {
            fileContent: '',
            filePath: join(input.outDir, input.emitConfig.namespace + '.js'),
        };

        const dtsOutput: Output = {
            fileContent: '',
            filePath: join(input.outDir, input.emitConfig.namespace + '.d.ts'),
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
	const __ns = \`${this.input.emitConfig.namespace}\`;\n`,
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
                lines.push(emitEnum(statement as EnumDeclaration, false));
            } else if (statement.nodeType === 'constDeclaration' && (statement as ConstDeclaration).isExported) {
                lines.push(emitConstDeclaration(statement as ConstDeclaration, false));
            } else if (statement.nodeType === 'messageDeclaration') {
                lines.push(emitMessageFactory(statement as MessageDeclaration, this.resolveImport));
            }
        }
        return lines.join('\n');
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
            const declarations = getTopLevelDeclarations(file.ast);
            for (const declaration of declarations) {
                if (declaration.isExported) {
                    lines.push(`    ${emitExported(declaration, true)}{ ${declaration.identifier.value} } from "${this.createNamespace(file.path)}";`);
                    if (declaration.nodeType === 'messageDeclaration') {
                        lines.push(
                            `    ${emitExported(declaration, true)}{ ${declaration.identifier.value}Factory } from "${this.createNamespace(file.path)}";`
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
                    lines.push(emitEnum(statement as EnumDeclaration, true));
                    break;
                case 'constDeclaration':
                    lines.push(emitConstDeclaration(statement as ConstDeclaration, true));
                    break;
                case 'messageDeclaration':
                    lines.push(emitMessageDeclaration(statement as MessageDeclaration));
                    lines.push(emitMessageFactoryDts(statement as MessageDeclaration));
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
                `${emitExported(ast, dts)}class ${ast.identifier.value} \n{` +
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
        return `	${dts ? `public ` : ``}static ${dts ? `readonly ` : ``} ${emitIdentifier(constant.identifier)}${
            dts ? `: ${emitTypeExpression(constant.type)}` : ''
        } ${dts ? '' : ` = ${emitExpression(constant.value)}`};`;
    }

    private emitServiceApiCall(serviceName: string, call: ServiceApiCall, dts: boolean): string {
        const callArg = emitTypeExpression(call.argument);

        return `	${dts ? `public ` : ``}static ${emitIdentifier(call.identifier)}(${callArg !== 'void' ? `body${dts ? `: ${callArg}` : ''}` : ''})${
            dts
                ? `:Promise<{response?: ${emitTypeExpression(call.returnType)}, error?: ${call.errorType ? emitTypeExpression(call.errorType) : 'Error'}}>`
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
        return `helium_client_rt.heliumHttpPost(\`${serviceName}\`, \`${call.identifier.value}\`, __ns, body, ${this.typeToFactory(
            call.argument
        )}, ${this.typeToFactory(call.returnType)}, ${this.typeToFactory(call.errorType)});`;
    }

    private typeToFactory(type: TypeExpression): string {
        const typeText = emitTypeExpression(type);
        if (typeText !== 'void') {
            return `exports.${typeText}Factory`;
        } else {
            return 'undefined';
        }
    }

    private emitTypeAlias(ast: TypeAliasDeclaration): string {
        return `	${emitExported(ast, true)}type ${ast.identifier.value} = ${emitTypeExpression(ast.type)};`;
    }
}
