import { BinaryReader, BinaryWriter, HeliumEncoding, initializeHeliumRuntime } from 'helium_client_rt';
import { MyService, TestMessage, TestMessageFactory } from 'helium_test_client';

export async function main() {
	initializeHeliumRuntime({
		encoding: HeliumEncoding.JSON,
		urlFactory: (serviceName: string, endpointName: string, namespace: string) => {
			return `http://localhost:3000/helium/${namespace}/${serviceName}/${endpointName}`;
		}
	});

	const writer = new BinaryWriter();
	const msg: TestMessage = {
		hello: 'world',
		b: [1, 2, 3]
	};
	TestMessageFactory.toBinary(msg, writer);

	const clone = TestMessageFactory.fromBinary(new BinaryReader(writer.toArrayBuffer()));
	console.log(msg);
	console.log(clone);
	console.log(clone === msg);

	const res = await MyService.reportMetric(msg);
	console.log(res);
}
