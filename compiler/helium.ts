const someStuff: string = '3';
type MyType = string | number;
export interface TestMessage extends SubMessage {
	hello: string;
	world?: string;
	a?: MyType;
	b?: number[];
}
interface SubMessage extends ExternalTestMessage {
	someField: AliasedTestType;
}
enum MyEnum {
	a = 1,
	b = 2,
	c = 3,
	d = 41
}

enum MyStringEnum {
	a = '1',
	b = '2',
	c = '3'
}

export class MyService {
	public static readonly randomServiceInfoThatGeneratedAsAStaticVariable: string = '2134';
	public static endpoint(SomeMessage): Promise<SubMessage>;
	public static reportMetric(Metric): Promise<void>;
}
