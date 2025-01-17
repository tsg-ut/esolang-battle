import assert from 'assert';
import {WebClient} from '@slack/web-api';
import contests from '../contests';
import langInfos from '../data/infos.json';
import langs from '../data/langs.json';
import docker from '../engines/docker';
import Language from '../models/Language';
import Submission, {SubmissionInfo} from '../models/Submission';
import * as discord from './discord';
import * as ptrace from './ptrace';
import io from './socket-io';
import {ContestInfo} from '../models/Contest';

const slackClient = new WebClient(process.env.SLACK_TOKEN);

function markError(submission: SubmissionInfo, error) {
	console.error(error);
	submission.status = 'error';
	submission.error.name = error.name;
	submission.error.stack = error.stack;
	submission.save();
}

function isValidTrace(language: string, trace: Buffer | null) {
	if (trace === null) {
		return true;
	}

	if (['bash-busybox', 'm4', 'cmd'].includes(language)) {
		return true;
	}

	const langInfo = langInfos.find(({slug}) => slug === language);
	if (!langInfo || !langInfo.execs) {
		return true;
	}

	const execs = ptrace.parse(trace.toString());
	return execs.length <= langInfo.execs.length;
}

interface ValidationQuery {
	submission: SubmissionInfo;
	language;
	solution: SubmissionInfo;
	contest: ContestInfo;
	noInputGeneration?: boolean;
}

export async function validate({
	submission,
	language,
	solution,
	contest,
	noInputGeneration,
}: ValidationQuery) {
	try {
		assert({}.hasOwnProperty.call(contests, contest.id));
		const {generateInput, isValidAnswer} = contests[contest.id];

		if (!noInputGeneration) {
			submission.input = generateInput();
		}
		const newSubmission = await submission.save();

		const info = await docker({
			id: language.slug,
			code: newSubmission.code,
			stdin: newSubmission.input,
			trace: !['bash-busybox', 'm4', 'cmd'].includes(language.slug),
			disasm: false,
		});
		console.log('info:', info);

		if (typeof info !== 'object') {
			throw new Error('info is not object');
		}

		const {stdout, stderr, duration, error, trace} = info;
		newSubmission.stdout = stdout.toString();
		newSubmission.stderr = stderr.toString();
		newSubmission.duration = duration;
		newSubmission.trace = trace.toString();

		if (error) {
			await newSubmission.save();
			throw error;
		}

		if (!isValidTrace(language.slug, trace)) {
			newSubmission.status = 'invalid';
			await newSubmission.save();
			return;
		}

		if (isValidAnswer(newSubmission.input, stdout)) {
			newSubmission.status = 'success';

			Language.updateOne(
				{slug: language.slug, contest},
				{$set: {solution: newSubmission._id}}
			).then(() => {
				io.emit('update-languages', {});
			});
		} else {
			newSubmission.status = 'failed';
		}

		const savedSubmission = await newSubmission.save();
		const populatedSubmission = await Submission.populate(savedSubmission, {
			path: 'user language',
		});

		if (populatedSubmission.status === 'success') {
			const bytesInfo = (() => {
				if (solution) {
					return `${
						[
							':heart:',
							':blue_heart:',
							':green_heart:',
							':yellow_heart:',
							':purple_heart:',
						][solution.user.getTeam(contest)]
					} **${solution.size} bytes** => ${
						[
							':heart:',
							':blue_heart:',
							':green_heart:',
							':yellow_heart:',
							':purple_heart:',
						][populatedSubmission.user.getTeam(contest)]
					} **${populatedSubmission.size} bytes**`;
				}

				return `:new: ${
					[
						':heart:',
						':blue_heart:',
						':green_heart:',
						':yellow_heart:',
						':purple_heart:',
					][populatedSubmission.user.getTeam(contest)]
				} **${populatedSubmission.size} bytes**`;
			})();

			try {
				discord.send(
					`**${populatedSubmission.user.name()}** won the language **${
						language.name
					}**!! (${bytesInfo}) Congrats!!!\nhttps://esolang.hakatashi.com/submissions/${
						populatedSubmission._id
					}`
				);
				await slackClient.chat.postMessage({
					channel: process.env.SLACK_CHANNEL,
					icon_emoji: ':tada:',
					username: 'esolang-battle',
					text: `*${populatedSubmission.user.name()}* won the language *${
						language.name
					}*!! (${bytesInfo}) Congrats!!!\nhttps://esolang.hakatashi.com/submissions/${
						populatedSubmission._id
					}`,
				});
			} catch (e) {
				console.error(e);
			}
		}
	} catch (error) {
		markError(submission, error);
	} finally {
		io.emit('update-submission', {_id: submission._id});

		// disasm

		const lang = langs.find(({slug}) => slug === language.slug);
		if (lang && lang.disasm) {
			const disasmInfo = await docker({
				id: language.slug,
				code: submission.code,
				stdin: '',
				trace: false,
				disasm: true,
			});
			console.log('disasm info:', disasmInfo);

			const result = await Submission.updateOne(
				{_id: submission._id},
				{$set: {disasm: disasmInfo.stdout}}
			);
			console.log({result});
		}
	}
}
