import groupBy from 'lodash/groupBy';

export function parse(trace: string): string[] {
	const lines = trace.split('\n').filter((line) => line.length);
	const entries = lines.map((line) => ({
		pid: parseInt(line.slice(0, 6)),
		body: line.slice(6),
	}));
	const processes = groupBy(entries, (entry) => entry.pid);
	const execs: string[] = [];
	for (const processEntries of Object.values(processes)) {
		for (const entry of processEntries) {
			const matches = entry.body.match(/^(\w+)\("(.+?)"/);
			if (matches) {
				const syscall = matches[1];
				const arg = matches[2];

				if (syscall === 'execve') {
					execs.push(arg);
				}
			}
		}
	}
	return execs;
};
