import { BinaryReader, BinaryWriter, HeliumEncoding, initializeHeliumRuntime } from 'helium_client_rt';
import { MyService, TestMessage, TestMessageFactory } from 'helium_test_client';

export async function main() {
    initializeHeliumRuntime({
        encoding: HeliumEncoding.BINARY,
        urlFactory: (serviceName: string, endpointName: string, namespace: string) => {
            return `/helium/${namespace}/${serviceName}/${endpointName}`;
        },
    });

    const writer = new BinaryWriter();
    const msg: TestMessage = {
        hello: 'world',
        b: [1, 2, 3],
        subMessage: {
            someField: 1234,
            test: 2,
        },
    };
    TestMessageFactory.toBinary(msg, writer);

    const clone = TestMessageFactory.fromBinary(new BinaryReader(writer.toArrayBuffer()));
    console.log(msg);
    console.log(clone);
    console.log(clone === msg);

    const res = await MyService.reportMetric(msg);
    res.response;
    console.log(res);
}
