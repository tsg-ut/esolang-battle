/* eslint-env browser */

import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import concatStream from 'concat-stream';
import Docker from 'dockerode';
import shellescape from 'shell-escape';
import tmp from 'tmp';
import {getCodeLimit, getTimeLimit} from '../controllers/utils.js';
import langInfos from '../data/infos.json';

const docker = new Docker();

const memoryLimit = 512 * 1024 * 1024;

class MemoryLimitExceededError extends Error {
	constructor(...args) {
		super(...args);
		this.name = 'MemoryLimitExceededError';
	}
}

const timeout = (promise, msec) => {
	const timeoutPromise = new Promise((_, reject) => {
		setTimeout(() => reject(new Error('operation timed out')), msec);
	});
	return Promise.race([promise, timeoutPromise]);
};

interface DockerQuery {
	id: string,
	code: Buffer,
	stdin: string,
	trace: boolean,
	disasm?: boolean,
	imageId?: string,
}

export default async function execDocker({
	id,
	code,
	stdin,
	trace: traceOption,
	disasm = false,
	imageId,
}: DockerQuery) {
	assert(typeof id === 'string');
	assert(imageId === undefined || typeof imageId === 'string');
	assert(Buffer.isBuffer(code));
	assert(typeof stdin === 'string');
	assert(code.length <= getCodeLimit(id));
	assert(stdin.length < 10000);

	const langInfo = langInfos.find(({slug}) => slug === id);
	const trace = traceOption && langInfo && langInfo.time && langInfo.time <= 10;

	const {tmpPath, cleanup}: {tmpPath: string, cleanup: () => void} = await new Promise((resolve, reject) => {
		tmp.dir({unsafeCleanup: true}, (error, dTmpPath, dCleanup) => {
			if (error) {
				reject(error);
			} else {
				resolve({tmpPath: dTmpPath, cleanup: dCleanup});
			}
		});
	});

	const stdinPath = path.join(tmpPath, 'INPUT');

	let filename = 'CODE';
	if (id === 'd-dmd') {
		filename = 'CODE.d';
	} else if (id === 'c-gcc') {
		filename = 'CODE.c';
	} else if (id === 'concise-folders' || id === 'pure-folders') {
		filename = 'CODE.tar';
	} else if (id === 'cmd') {
		filename = 'CODE.bat';
	} else if (id === 'nadesiko') {
		filename = 'CODE.nako3';
	}

	const codePath = path.join(tmpPath, filename);

	await Promise.all([
		fs.writeFile(stdinPath, stdin),
		fs.writeFile(codePath, code),
	]);

	let container = null;

	try {
		// eslint-disable-next-line init-declarations
		let stderrWriter, stdoutWriter;

		const stdoutPromise = new Promise((resolve) => {
			stdoutWriter = concatStream((stdout) => {
				resolve(stdout);
			});
		});

		const stderrPromise = new Promise((resolve) => {
			stderrWriter = concatStream((stderr) => {
				resolve(stderr);
			});
		});

		const dockerVolumePath = (() => {
			if (path.sep === '\\') {
				return tmpPath.replace('C:\\', '/c/').replace(/\\/g, '/');
			}

			return tmpPath;
		})();

		const containerPromise = (async () => {
			container = await docker.createContainer({
				Hostname: '',
				User: '',
				AttachStdin: false,
				AttachStdout: true,
				AttachStderr: true,
				Tty: false,
				OpenStdin: false,
				StdinOnce: false,
				Env: trace === true ? ['STRACE_OUTPUT_PATH=/volume/strace.log'] : null,
				Cmd: [
					'sh',
					'-c',
					`${shellescape([
						'script',
						...(disasm ? ['-d'] : []),
						`/volume/${filename}`,
					])} < /volume/INPUT`,
				],
				Image: imageId || `esolang/${id}`,
				Volumes: {
					'/volume': {},
				},
				HostConfig: {
					Binds: [
						`${dockerVolumePath}:/volume:${trace === true ? 'rw' : 'ro'}`,
					],
					Memory: memoryLimit,
					...(trace === true ? {CapAdd: ['SYS_PTRACE']} : {}),
				},
			});

			const stream = await container.attach({
				stream: true,
				stdout: true,
				stderr: true,
			});

			container.modem.demuxStream(stream, stdoutWriter, stderrWriter);
			stream.on('end', () => {
				stdoutWriter.end();
				stderrWriter.end();
			});

			await container.start();
			await container.wait();
			const data = await container.inspect();
			await container.remove();
			return data;
		})();

		const runner = Promise.all([
			stdoutPromise,
			stderrPromise,
			containerPromise,
		]);

		const executionStart = Date.now();
		const [stdout, stderr, containerData] = await timeout(
			runner,
			getTimeLimit(id),
		);
		const executionEnd = Date.now();

		const tracePath = path.join(tmpPath, 'strace.log');
		const traceLog = trace && (await fs.readFile(tracePath));

		cleanup();

		return {
			stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.alloc(0),
			stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.alloc(0),
			duration: executionEnd - executionStart,
			...(containerData.State.OOMKilled
				? {
					error: new MemoryLimitExceededError(
						`Memory limit of ${memoryLimit} bytes exceeded`,
					),
				  }
				: {}),
			trace: trace ? traceLog : null,
		};
	} catch (error) {
		if (container) {
			await container.kill().catch((e) => {
				console.error('error:', e);
			});
			await container.remove().catch((e) => {
				console.error('error:', e);
			});
		}
		throw error;
	}
};
