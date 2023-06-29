import assert from 'assert';
import concat from 'lodash/concat';
import includes from 'lodash/includes';
import range from 'lodash/range';
import sample from 'lodash/sample';
import shuffle from 'lodash/shuffle';

export function getPrecedingIndices(cellIndex: number) {
	const width = 5;
	const height = 5;
	assert(cellIndex >= 0);
	assert(cellIndex < width * height);

	const x = cellIndex % width;
	const y = Math.floor(cellIndex / width);

	const precedingCells: number[] = [];
	if (x - 1 >= 0) {
		precedingCells.push(y * width + (x - 1));
	}
	if (x + 1 < width) {
		precedingCells.push(y * width + (x + 1));
	}
	if (y - 1 >= 0) {
		precedingCells.push((y - 1) * width + x);
	}
	if (y + 1 < height) {
		precedingCells.push((y + 1) * width + x);
	}

	return precedingCells.filter(
		(cell) => ![0, 4, 5, 9, 10, 14, 15, 19, 20, 24].includes(cell)
	);
}

const ascendingCases = ['0123', '1230', '2301', '3012'];
const descendingCases = ['3210', '0321', '1032', '2103'];
const cases = concat(ascendingCases, descendingCases);

const lineNum = 32;

assert(lineNum > cases.length);

export function generateInput() {
	const determinedNumbers = range(cases.length);
	const randomNumbers = range(lineNum - cases.length).map(() =>
		sample(range(cases.length))
	);
	const numbers = shuffle(concat(determinedNumbers, randomNumbers));
	const lines = numbers.map((n) => cases[n]);

	return `${lines.join('\n')}\n`;
}

export function isValidAnswer(input: string, output: Buffer) {
	const inputLines = input.trim().split('\n');

	assert(inputLines.length === lineNum);

	const correctOutput = inputLines
		.map((line) => (includes(ascendingCases, line) ? 1 : 0))
		.join('');
	const trimmedOutput = output.toString().replace(/\s/g, '');

	console.log('info:', {input, correctOutput, output, trimmedOutput});

	return trimmedOutput === correctOutput;
}
