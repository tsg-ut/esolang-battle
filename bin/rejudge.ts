import assert from 'assert';
import mongoose from 'mongoose';
import languagesData from '../data/languages';
import {validate} from '../lib/validation';
import Contest from '../models/Contest';
import Language from '../models/Language';
import Submission from '../models/Submission';
import '../models/User';

mongoose.Promise = global.Promise;

(async () => {
	await mongoose.connect('mongodb://localhost:27017/esolang-battle');
	const contest = await Contest.findOne({id: '5'});
	const languages = await Language.find({
		contest,
		solution: {$ne: null},
		slug: 'canvas',
	});

	// rollback
	for (const language of languages) {
		console.log(`Rejudging language ${language.slug}...`);
		const languageData = languagesData[contest.id].find(
			(l) => l && l.slug === language.slug,
		);
		assert(languageData);

		while (true) {
			const submission = await Submission.findOne({
				contest,
				language,
			})
				.sort({createdAt: -1})
				.exec();

			if (!submission) {
				console.log('Solution not found.');
				language.solution = null;
				await language.save();
				break;
			}

			console.log(`Rejudging submission ${submission._id}...`);

			await validate({
				submission,
				language: languageData,
				solution: null,
				contest,
				noInputGeneration: true,
			});

			const newSubmission = await Submission.findOne({_id: submission._id});
			assert(newSubmission);
			console.log(newSubmission);

			if (newSubmission.status === 'success') {
				console.log(`Solution found as ${newSubmission._id}`);
				language.solution = newSubmission;
				await language.save();
				break;
			}

			console.log(`${newSubmission._id} is invalid`);
		}
	}

	mongoose.connection.close();
})();
