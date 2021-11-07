import { InputStream } from './input';

export function lexer(input: InputStream): TokenStream {
	return new TokenStream(input);
}

export type BuiltinType =
	| 'byte'
	| 'ushort'
	| 'short'
	| 'uint'
	| 'int'
	| 'ulong'
	| 'long'
	| 'float'
	| 'double'
	| 'string'
	| 'date'
	| 'map'
	| 'set'
	| 'void'
	| 'null'
	| 'boolean';

export const builtinTypes: BuiltinType[] = [
	'byte',
	'ushort',
	'short',
	'uint',
	'int',
	'long',
	'ulong',
	'float',
	'double',
	'string',
	'date',
	'map',
	'set',
	'void',
	'null',
	'boolean'
];
export type Keyword =
	| 'client'
	| 'import'
	| 'export'
	| 'message'
	| 'enum'
	| 'service'
	| 'http'
	| 'ws'
	| 'tcp'
	| 'const'
	| 'extends'
	| 'interface'
	| 'type'
	| 'from'
	| 'oneof'
	| 'throws'
	| 'as';

const KEYWORDS: Keyword[] = [
	'import',
	'export',
	'message',
	'enum',
	'service',
	'client',
	'tcp',
	'ws',
	'http',
	'const',
	'extends',
	'interface',
	'type',
	'from',
	'oneof',
	'throws',
	'as'
];

export interface Token {
	type: 'keyword' | 'identifier' | 'punctuation' | BuiltinType | 'arrow' | 'operation' | 'type';
	value: any;
}

export class TokenStream {
	private carret: { line: number; character: number; index: number };
	private backtrackIndex: number = 0;
	private tokenStack: Token[] = [];
	private input: InputStream;
	private upcoming: Token = undefined;
	public source: string;
	public file: string;

	constructor(input: InputStream) {
		this.input = input;
		this.source = input.source;
		this.file = input.fileName;
		this.carret = input.getCarret();
	}

	private isKeyword(x: string): boolean {
		return KEYWORDS.includes(x as Keyword);
	}

	private isType(x: string): boolean {
		return builtinTypes.includes(x as BuiltinType);
	}

	private isOperationChar(ch: string): boolean {
		return '+-*/%=&|<>^!'.includes(ch);
	}

	private isBool(x: string): boolean {
		if (x === 'true' || x === 'false') {
			return true;
		} else {
			return false;
		}
	}

	private isHexDigit(ch: string): boolean {
		return /[0-9a-f]/i.test(ch);
	}

	private isDigit(ch: string): boolean {
		return /[0-9]/i.test(ch);
	}

	private isIdStart(ch: string): boolean {
		return /[a-z_]/i.test(ch);
	}

	private isStringStart(ch: string): boolean {
		return ch === '"' || ch === "'" || ch === '`';
	}

	private isId(ch: string): boolean {
		return this.isIdStart(ch) || '0123456789'.includes(ch);
	}

	private isPunc(ch: string): boolean {
		return ',;:(){}[]|@'.includes(ch);
	}

	public isWhitespace(ch: string): boolean {
		return ' \t\n'.includes(ch);
	}

	private readWhile(predicate: (ch: string) => boolean): string {
		let str: string = '';

		while (!this.input.eof() && predicate(this.input.peek())) str += this.input.next();
		return str;
	}

	private readHexNumber(): Token {
		let number = this.readWhile((ch) => {
			return this.isHexDigit(ch);
		});

		return {
			type: 'int',
			value: parseInt(number, 16)
		};
	}

	private readNumber(): Token {
		let hasDot = false;
		let isFloat = false;
		let isLong = false;
		let number = this.readWhile((ch) => {
			if (ch == '.') {
				if (hasDot) {
					return false;
				}
				hasDot = true;
				return true;
			}
			return this.isDigit(ch);
		});

		if (this.input.peek() === 'f') {
			isFloat = true;
			this.input.next();
		}

		if (this.input.peek() === 'l') {
			isLong = true;
			this.input.next();
		}

		if (isLong) {
			return { type: 'long', value: BigInt(number) };
		} else if (isFloat) {
			return { type: 'float', value: parseFloat(number) };
		} else if (hasDot) {
			return { type: 'double', value: parseFloat(number) };
		} else {
			return { type: 'int', value: parseInt(number) };
		}
	}

	private readId(): Token {
		let id = this.readWhile(this.isId.bind(this));
		if (this.isBool(id)) {
			return {
				type: 'boolean',
				value: id
			};
		}

		return {
			type: this.isType(id) ? 'type' : this.isKeyword(id) ? 'keyword' : 'identifier',
			value: id
		};
	}

	private readEscaped(delimiter: string): string {
		let escaped = false,
			str = '';
		this.input.next();
		while (!this.input.eof()) {
			let ch = this.input.next();
			if (escaped) {
				str += ch;
				escaped = false;
			} else if (ch == '\\') {
				escaped = true;
			} else if (ch == delimiter) {
				break;
			} else {
				str += ch;
			}
		}
		return str;
	}

	private readString(delimiter: string): Token {
		const string = this.readEscaped(delimiter);
		return {
			type: 'string',
			value: string
		};
	}

	private skipComment(): void {
		this.readWhile(function (ch) {
			return ch != '\n';
		});
		this.input.next();
	}

	private skipMultilineComment(): void {
		while (true) {
			this.readWhile(function (ch) {
				return ch != '*';
			});
			this.input.next();
			if (this.eof()) {
				break;
			}
			if (this.input.peek() == '/') {
				this.input.next();
				break;
			}
		}
		this.input.next();
	}

	private readNext(): Token {
		this.readWhile(this.isWhitespace.bind(this));
		if (this.input.eof()) {
			return undefined;
		}

		let ch = this.input.peek();
		if (ch == '/' && this.input.peekAhead() === '/') {
			this.skipComment();
			return this.readNext();
		}

		if (ch == '/' && this.input.peekAhead() === '*') {
			this.skipMultilineComment();
			return this.readNext();
		}

		if (ch == '-' && this.input.peekAhead() === '>') {
			this.input.skip(2);
			return {
				type: 'arrow',
				value: '->'
			};
		}

		if (this.input.peekRange(4) === 'null') {
			this.input.skip(4);
			return {
				type: 'null',
				value: null
			};
		}

		if (this.isStringStart(ch)) {
			return this.readString(ch);
		}

		if (this.input.peekRange(2) === '0x') {
			this.input.skip(2);
			return this.readHexNumber();
		}

		if (this.isDigit(ch)) {
			return this.readNumber();
		}
		if (this.isIdStart(ch)) {
			return this.readId();
		}

		if (this.isPunc(ch)) {
			return {
				type: 'punctuation',
				value: this.input.next()
			};
		}
		if (this.isOperationChar(ch)) {
			return {
				type: 'operation',
				value: this.readWhile(this.isOperationChar.bind(this))
			};
		}

		this.input.croak(`Unexpected character ${ch}`);
	}

	public getCarret(): { line: number; character: number; index: number } {
		const copy = { ...this.carret };
		copy.index -= this.backtrackIndex;
		return copy;
	}

	public peek(): Token {
		if (this.backtrackIndex) {
			return this.tokenStack[this.tokenStack.length - this.backtrackIndex];
		}
		return this.upcoming || (this.upcoming = this.readNext());
	}

	public next(): Token {
		if (this.backtrackIndex) {
			return this.tokenStack[this.tokenStack.length - this.backtrackIndex--];
		}
		let tok = this.upcoming;
		this.upcoming = undefined;
		if (!tok) {
			tok = this.readNext();
		}
		this.tokenStack.push(tok);
		this.carret = this.input.getCarret();
		return tok;
	}

	public eof(): boolean {
		return this.peek() === undefined;
	}

	public croak(msg: string): never {
		this.input.croak(msg);
	}

	public backtrack(): void {
		this.backtrackIndex++;
	}
}
