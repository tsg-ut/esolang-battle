import assert from 'assert';
import range from 'lodash/range';
import sample from 'lodash/sample';
import shuffle from 'lodash/shuffle';

export function getPrecedingIndices(cellIndex: number): number[] {
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
		(cell) => ![0, 4, 5, 9, 10, 14, 15, 19, 20, 24].includes(cell),
	);
};

const alphabets = range(26).map(
	(i) => String.fromCharCode('a'.charCodeAt(0) + i) +
		String.fromCharCode('A'.charCodeAt(0) + i),
);

export function generateInput() {
	const n = sample(range(1, 26));
	const numbers = shuffle(('1'.repeat(n) + '0'.repeat(26 - n)).split(''));
	const letters = numbers.map((n, i) => String.fromCharCode(i + (n === '1' ? 'A' : 'a').charCodeAt(0)));

	assert(letters.length === 26);

	return `${letters.join('')}\n`;
};

export function isValidAnswer(input: string, output: Buffer) {
	const chunks = input.split(/(?=[a-zA-Z])/);

	assert(chunks.length === 26);

	const correctOutput = chunks
		.map((chunk) => (chunk === chunk.toUpperCase() ? 1 : 0))
		.join('');
	const trimmedOutput = output.toString().replace(/\s/g, '');

	console.log('info:', {input, correctOutput, output, trimmedOutput});

	return trimmedOutput === correctOutput;
};
