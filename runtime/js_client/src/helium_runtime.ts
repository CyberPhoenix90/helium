const emptyString = '';

/**
 * The encoding to use during transport. JSON is useful for debugging, but binary is recommended for production due to large performance difference.
 * Encoding must be the same on both client and server.
 */
export enum HeliumEncoding {
	/**
	 * Use JSON encoding. Low performance. Recommended for debugging.
	 */
	JSON,
	/**
	 * Use binary encoding. High performance. Recommended for production.
	 */
	BINARY
}
let heliumConfig: HeliumConfig;

export interface ValidationError<P, T> {
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

export type HeliumMessageFactory<T> = {
	validate(msg: T): ValidationError<T, any>[];
	fromBinary(binaryReader: BinaryReader): T;
	toBinary(message: T, writer: BinaryWriter): void;
	fromJSON(json: string): T;
	toJSON(message: T): string;
	/**
	 * Allows you to create a new instance where all the defaults are filled in and the state is validated
	 */
	createInstance(instance: T): T;
};

export interface HeliumConfig {
	encoding: HeliumEncoding;
	urlFactory: (serviceName: string, endpointName: string, namespace: string) => string;
	headerFactory?: (url: string, serviceName: string, endpointName: string, namespace: string) => { [key: string]: string };
	/**
	 * Function to do the actual request. Defaults to using fetch if not provided
	 */
	get?: (url: string, headers: { [key: string]: string }) => Promise<any>;
	/**
	 * Function to do the actual request. Defaults to using fetch if not provided
	 */
	post?: (url: string, body: any, headers: { [key: string]: string }) => Promise<any>;
	/**
	 * Needed in case websocket APIs are used
	 */
	websocket?: WebSocket;
	/**
	 * In bytes.
	 * Defaults to 64 MB. If a message to be sent is larger than this, an error will be thrown
	 * Note that sending large messages is not recommended and should be split into smaller messages for better performance
	 */
	maxMessageSize?: number;
}

export function initializeHeliumRuntime(config: HeliumConfig): void {
	heliumConfig = config;
}

/**
 * Used internally
 */
export async function heliumHttpGet(
	serviceName: string,
	endpointName: string,
	namespace: string,
	responseTypes: HeliumMessageFactory<any>,
	errorTypes: HeliumMessageFactory<any>
): Promise<any> {
	if (!heliumConfig) {
		throw new Error('Helium Runtime not initialized');
	}

	const url = heliumConfig.urlFactory(serviceName, endpointName, namespace);
	const headers = heliumConfig.headerFactory ? heliumConfig.headerFactory(url, serviceName, endpointName, namespace) : {};

	if (heliumConfig.get) {
		return heliumConfig.get(url, headers);
	} else {
		const response = await fetch(url, {
			method: 'GET',
			headers
		});
		return await decodeResponse(response, responseTypes, errorTypes);
	}
}

/**
 * Used internally
 */
export async function heliumHttpPost(
	serviceName: string,
	endpointName: string,
	namespace: string,
	body: any,
	factory: HeliumMessageFactory<any>,
	responseTypes: HeliumMessageFactory<any>,
	errorTypes: HeliumMessageFactory<any>
): Promise<any> {
	if (!heliumConfig) {
		throw new Error('Helium Runtime not initialized');
	}

	const url = heliumConfig.urlFactory(serviceName, endpointName, namespace);
	const headers = heliumConfig.headerFactory ? heliumConfig.headerFactory(url, serviceName, endpointName, namespace) : {};

	if (heliumConfig.post) {
		return heliumConfig.post(url, body, headers);
	} else {
		let encodedBody;
		if (heliumConfig.encoding === HeliumEncoding.JSON) {
			encodedBody = JSON.stringify(body);
		} else {
			const writer = new BinaryWriter();
			factory.toBinary(body, writer);
			encodedBody = writer.toArrayBuffer();
		}

		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: encodedBody
		});
		return await decodeResponse(response, responseTypes, errorTypes);
	}
}

function decodeResponse(response: Response, successOptions: HeliumMessageFactory<any>, errorOptions: HeliumMessageFactory<any>): Promise<any> {
	if (response.headers.get('Content-Type') === 'application/json') {
		return response.json();
	} else if (response.headers.get('Content-Type') === 'application/octet-stream') {
		return response.arrayBuffer().then((buffer) => {
			const binaryReader = new BinaryReader(buffer);
			const isSuccess = binaryReader.readBoolean();
			if (isSuccess) {
				const message = successOptions.fromBinary(binaryReader);
				return message;
			} else {
				const message = errorOptions.fromBinary(binaryReader);
				return message;
			}
		});
	} else {
		throw new Error('Unknown encoding');
	}
}

export class BinaryWriter {
	private static writeBuffer: ArrayBuffer = new ArrayBuffer(2048);
	private static writeBufferView: DataView = new DataView(BinaryWriter.writeBuffer);
	private offset: number;

	constructor() {
		this.offset = 0;
	}

	public writeBoolean(value: boolean): void {
		this.writeByte(value ? 1 : 0);
	}

	public writeByte(value: number): void {
		this.guaranteeBufferLength(this.offset + 1);
		BinaryWriter.writeBufferView.setUint8(this.offset, value);
		this.offset += 1;
	}

	public writeInt16(value: number): void {
		this.guaranteeBufferLength(this.offset + 2);
		BinaryWriter.writeBufferView.setInt16(this.offset, value, true);
		this.offset += 2;
	}

	public writeInt32(value: number): void {
		this.guaranteeBufferLength(this.offset + 4);
		BinaryWriter.writeBufferView.setInt32(this.offset, value, true);
		this.offset += 4;
	}

	public writeInt64(value: number): void {
		this.guaranteeBufferLength(this.offset + 8);
		BinaryWriter.writeBufferView.setBigInt64(this.offset, BigInt(value), true);
		this.offset += 8;
	}

	public writeFloat32(value: number): void {
		this.guaranteeBufferLength(this.offset + 4);
		BinaryWriter.writeBufferView.setFloat32(this.offset, value, true);
		this.offset += 4;
	}

	public writeFloat64(value: number): void {
		this.guaranteeBufferLength(this.offset + 8);
		BinaryWriter.writeBufferView.setFloat64(this.offset, value, true);
		this.offset += 8;
	}

	public writeString(value: string): void {
		const bytes = new TextEncoder().encode(value);
		this.guaranteeBufferLength(this.offset + bytes.length + 4);
		this.writeUInt32(bytes.length);
		for (let i = 0; i < bytes.length; i++) {
			BinaryWriter.writeBufferView.setUint8(this.offset + i, bytes[i]);
		}
		this.offset += bytes.length;
	}

	public writeUInt32(value: number): void {
		this.guaranteeBufferLength(this.offset + 4);
		BinaryWriter.writeBufferView.setUint32(this.offset, value, true);
		this.offset += 4;
	}

	public writeUInt64(value: number): void {
		this.guaranteeBufferLength(this.offset + 8);
		BinaryWriter.writeBufferView.setBigUint64(this.offset, BigInt(value), true);
		this.offset += 8;
	}

	public writeBytes(value: Uint8Array): void {
		this.guaranteeBufferLength(this.offset + value.length + 4);
		this.writeUInt32(value.length);
		for (let i = 0; i < value.length; i++) {
			BinaryWriter.writeBufferView.setUint8(this.offset + i, value[i]);
		}
		this.offset += value.length;
	}

	public writeBase64(value: string): void {
		const bytes = atob(value);
		this.guaranteeBufferLength(this.offset + 4 + bytes.length);
		this.writeUInt32(bytes.length);
		for (let i = 0; i < bytes.length; i++) {
			BinaryWriter.writeBufferView.setUint8(this.offset + i, bytes.charCodeAt(i));
		}
		this.offset += bytes.length;
	}

	public writeDate(value: Date): void {
		this.writeInt64(value.getTime());
	}

	public writeMap(value: Map<any, any>, keyFactory: HeliumMessageFactory<any>, valueFactory: HeliumMessageFactory<any>): void {
		this.writeUInt32(value.size);
		value.forEach((value, key) => {
			keyFactory.toBinary(key, this);
			valueFactory.toBinary(value, this);
		});
	}

	public writeArray(value: any[], itemFactory: HeliumMessageFactory<any>): void {
		this.writeUInt32(value.length);
		for (let i = 0; i < value.length; i++) {
			itemFactory.toBinary(value[i], this);
		}
	}

	public toArrayBuffer(): ArrayBuffer {
		return BinaryWriter.writeBuffer.slice(0, this.offset);
	}

	public reset(): void {
		this.offset = 0;
	}

	private guaranteeBufferLength(length: number): void {
		if (length > (heliumConfig.maxMessageSize ?? 64 * 1024 * 1024)) {
			throw new Error(
				`Message size of ${length} bytes exceeds maximum size of ${
					heliumConfig.maxMessageSize ?? 64 * 1024 * 1024
				} bytes. If this is intentional, set heliumConfig.maxMessageSize to override this limit.`
			);
		}

		if (BinaryWriter.writeBufferView.byteLength < length) {
			let newLen;
			if (length > BinaryWriter.writeBufferView.byteLength * 2) {
				newLen = 2 ** Math.floor(Math.log2(129 - 1) + 2);
			} else {
				newLen = BinaryWriter.writeBufferView.byteLength * 2;
			}

			const newBuffer = new ArrayBuffer(newLen);
			const newView = new DataView(newBuffer);
			for (let i = 0; i < BinaryWriter.writeBufferView.byteLength; i++) {
				newView.setUint8(i, BinaryWriter.writeBufferView.getUint8(i));
			}
			BinaryWriter.writeBufferView = newView;
		}
	}
}

export class BinaryReader {
	public offset: number;
	private data: DataView;
	static textDecoder = new TextDecoder();

	constructor(data: ArrayBuffer) {
		this.data = new DataView(data);
		this.offset = 0;
	}

	public readByte(): number {
		return this.data.getUint8(this.offset++);
	}

	public readInt16(): number {
		const value = this.data.getInt16(this.offset, true);
		this.offset += 2;
		return value;
	}

	public readInt32(): number {
		const value = this.data.getInt32(this.offset, true);
		this.offset += 4;
		return value;
	}

	public readInt64(): number {
		const value = this.readInt32() * Math.pow(2, 32) + this.readInt32();
		return value;
	}

	public readUInt16(): number {
		const value = this.data.getUint16(this.offset, true);
		this.offset += 2;
		return value;
	}

	public readUInt32(): number {
		const value = this.data.getUint32(this.offset, true);
		this.offset += 4;
		return value;
	}

	public readFloat32(): number {
		const value = this.data.getFloat32(this.offset, true);
		this.offset += 4;
		return value;
	}

	public readFloat64(): number {
		const value = this.data.getFloat64(this.offset, true);
		this.offset += 8;
		return value;
	}

	public readString(): string {
		const length = this.readUInt32();

		if (length === 0) {
			return emptyString;
		}

		const value = BinaryReader.textDecoder.decode(new Uint8Array(this.data.buffer, this.offset, length));
		this.offset += length;
		return value;
	}

	public readBytes(length: number): Uint8Array {
		const value = new Uint8Array(this.data.buffer, this.offset, length);
		this.offset += length;
		return value;
	}

	public readBoolean(): boolean {
		const value = this.readByte() !== 0;
		return value;
	}

	public readDate(): Date {
		const value = new Date(this.readInt64());
		return value;
	}
}
