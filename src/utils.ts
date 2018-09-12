const debug = require('debug');


export function createLogger(namespace: string): (msg: string) => void {
	return debug(namespace);
}

export function getTime(): number {
	const [sec, nano] = process.hrtime();
	return sec * 1000000000 + nano;
}

export function dePromise() {
	let resolve, reject;
	let promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

export async function streamForEach<T>(stream: NodeJS.ReadableStream, action: (item: T) => any): Promise<void> {
	let actionsDone = Promise.resolve();
	const { promise: streamDone, resolve: streamDoneResolve, reject: streamDoneReject } = dePromise();

	stream.on('data', item => actionsDone = actionsDone.then(() => action(item)));
	stream.on('error', streamDoneReject);
	stream.on('end', streamDoneResolve);
	stream.resume();

	await Promise.all([streamDone, actionsDone]);
}

const DATE_REGEX = /^FLEXEL\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function dateReviver(key: string, value: any): Date | any {
	if (typeof value === 'string' && DATE_REGEX.test(value)) {
		return new Date(value.slice(7));
	}

	return value;
}

function encodeDates(data: any): any {
	if (data === null || typeof data === 'undefined') return data;

	if (data instanceof Date) return `FLEXEL|${data.toISOString()}`;

	if (typeof data === 'object' && data.constructor === Object) {
		let newObj: any = {};
		for (let prop in data) {
			newObj[prop] = encodeDates(data[prop]);
		}
		return newObj;
	}

	return data;
}

export const advancedJsonEncoding = {
	encode: (obj: any) => JSON.stringify(encodeDates(obj)),
	decode: (json: string) => JSON.parse(json, dateReviver),
	buffer: false,
	type: 'advanced-json'
};