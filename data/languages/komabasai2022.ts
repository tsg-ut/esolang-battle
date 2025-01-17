import assert from 'assert';
import flatten from 'lodash/flatten';
import langsData from '../langs.json';

const languages = [
	['', 'fish', 'produire', 'cpp-clang', ''],
	['', '', 'haskell', '', ''],
	['', 'c-gcc', 'brainfuck-esomer', 'python3', ''],
	['', '', 'node', '', ''],
	['', 'ruby', 'aheui', 'ocaml', ''],
];

export default flatten(languages).map((language, index) => {
	if (index === 6 || index === 18) {
		return {
			type: 'base',
			team: 1,
		};
	}

	if (index === 8 || index === 16) {
		return {
			type: 'base',
			team: 0,
		};
	}

	const langDatum = langsData.find((lang) => lang.slug === language);
	assert(language === '' || langDatum !== undefined, language);

	return {
		type: 'language',
		slug: language,
		name: langDatum ? langDatum.name : '',
		link: langDatum ? langDatum.link : '',
	};
});
