export class InputStream {
	private pos = 0;
	private line = 1;
	private col = 0;
	public readonly source: string;
	public readonly fileName: string;

	constructor(input: string, fileName: string) {
		this.source = input;
		this.fileName = fileName;
	}

	public getCarret(): { line: number; character: number; index: number } {
		return {
			character: this.col,
			line: this.line,
			index: this.pos
		};
	}

	public next(): string {
		var ch = this.source.charAt(this.pos++);
		if (ch == '\n') {
			this.line++, (this.col = 0);
		} else {
			this.col++;
		}
		return ch;
	}

	public skip(count: number): void {
		while (count--) {
			this.next();
		}
	}

	public peek(): string {
		return this.source.charAt(this.pos);
	}

	public peekAhead(): string {
		return this.source.charAt(this.pos + 1);
	}

	public peekRange(count: number): string {
		let result: string = '';
		for (let i = 0; i < count; i++) {
			result += this.source.charAt(this.pos + i);
		}
		return result;
	}

	public eof(): boolean {
		return this.peek() == '';
	}

	public croak(msg: string): never {
		throw new Error(`${this.fileName}:${this.line}:${this.col} - error ${msg}`);
	}
}
