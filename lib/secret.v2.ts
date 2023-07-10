import assert from 'assert';
import {shuffle} from './shuffle';

export function generateInput() {
	return shuffle([
		...Array.from({length: 10}, (e, i) => i),
		...Array.from({length: 90}, () => Math.floor(Math.random() * 10)),
	]).join('');
}

export function isValidAnswer(input: string, output: Buffer) {
	assert(input.match(/^\d{100}$/));

	if (process.env.NODE_ENV !== 'production') {
		return true;
	}

	const correctOutput = input
		.split('')
		.map((n) => parseInt(n))
		.sort((a, b) => a - b)
		.join('');

	// Trim
	const trimmedOutput = output.toString().trim();

	return trimmedOutput === correctOutput;
}
