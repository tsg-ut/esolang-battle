import qs from 'querystring';
import concatStream from 'concat-stream';
import Hexdump from 'hexdump-stream';
import isValidUTF8 from 'utf-8-validate';
import Language from '../models/Language';
import Submission from '../models/Submission';
import User from '../models/User';
import { Request, Response } from 'express';

/*
 * GET /submissions
 */
export async function getSubmissions(req: Request, res: Response) {
	const query = {
		contest: req.contest,
		user: undefined,
		language: undefined,
		status: undefined,
	};

	if (req.query.author) {
		const author = await User.findOne({
			email: `${req.query.author}@twitter.com`,
		});
		if (author) {
			query.user = author._id;
		}
	}

	if (req.query.language) {
		const language = await Language.findOne({
			slug: req.query.language,
			contest: req.contest,
		});
		if (language) {
			query.language = language._id;
		}
	}

	const page = parseInt(req.query && req.query.page as string) || 0;

	if (req.query.status) {
		query.status = req.query.status;
	}

	const submissions = await Submission.find(query)
		.sort({_id: -1})
		.populate('user')
		.populate('language')
		.skip(500 * page)
		.limit(500)
		.exec();

	const totalSubmissions = await Submission.find(query)
		.countDocuments()
		.exec();

	const users_id = await Submission.find({contest: req.contest})
		.distinct('user')
		.exec();
	const langs_id = await Submission.find({contest: req.contest})
		.distinct('language')
		.exec();
	const usersRecord = await User.find({_id: {$in: users_id}}).exec();
	const langsRecord = await Language.find({_id: {$in: langs_id}}).exec();
	const users = usersRecord
		.map((user) => {
			const team = user.team.find((t) => t.contest.equals(req.contest._id));
			const displayName = (team ? `team-${team.value}` : '') + user.name();
			return {email: user.email, displayName};
		})
		.sort(({displayName: dispA}, {displayName: dispB}) => dispA.localeCompare(dispB));
	const langs = langsRecord.sort(({slug: slugA}, {slug: slugB}) => slugA.localeCompare(slugB));

	res.render('submissions', {
		contest: req.contest,
		title: 'Submissions',
		submissions,
		users,
		langs,
		page,
		query: req.query || {},
		totalPages: Math.ceil(totalSubmissions / 500),
		encode: qs.encode,
	});
};

/*
 * GET /submissions/:submission
 */
export async function getSubmission(req: Request, res: Response) {
	const _id = req.params.submission;

	const submission = await Submission.findOne({_id})
		.populate('user')
		.populate('language')
		.populate('contest')
		.exec();

	if (submission === null) {
		res.sendStatus(404);
		return;
	}

	if (submission.contest.id !== req.params.contest) {
		res.redirect(
			`/contests/${submission.contest.id}/submissions/${submission._id}`,
		);
		return;
	}

	const {code, isHexdump} = await new Promise<{code: string, isHexdump: boolean}>((resolve) => {
		// eslint-disable-next-line no-control-regex
		if (
			isValidUTF8(submission.code) &&
			!submission.code
				.toString()
				.match(/[\x00-\x08\x0b\x0c\x0e-\x1F\x7F\x80-\x9F]/)
		) {
			resolve({code: submission.code.toString(), isHexdump: false});
			return;
		}

		const hexdump = new Hexdump();
		const concatter = concatStream((dump) => {
			resolve({code: dump.toString(), isHexdump: true});
		});

		hexdump.pipe(concatter);
		hexdump.end(submission.code);
	});

	res.render('submission', {
		contest: req.contest,
		title: `Submission by ${submission.user.name()} (${
			submission.language.slug
		}, ${submission.size} bytes)`,
		submission,
		code,
		isHexdump,
		selfTeam:
			req.user &&
			req.user.getTeam(req.contest) === submission.user.getTeam(req.contest),
	});
};

export async function getOldSubmission(req: Request, res: Response) {
	const _id = req.params.submission;

	const submission = await Submission.findOne({_id})
		.populate('contest')
		.exec();

	if (submission === null) {
		res.sendStatus(404);
		return;
	}

	res.redirect(
		`/contests/${submission.contest.id}/submissions/${submission._id}`,
	);
};

/*
 * GET /contest/:contest/submissions/:submission/raw
 */
export async function getRawSubmission(req: Request, res: Response) {
	const _id = req.params.submission;

	const submission = await Submission.findOne({_id})
		.populate('user')
		.exec();
	const selfTeam =
		req.user &&
		req.user.getTeam(req.contest) === submission.user.getTeam(req.contest);

	if (!selfTeam && !req.contest.isEnded() && !(req.user && req.user.admin)) {
		res.sendStatus(403);
		return;
	}

	if (submission === null) {
		res.sendStatus(404);
		return;
	}

	res.set({
		'Content-Type': 'text/plain',
		'Content-Disposition': 'attachment',
	});

	res.send(submission.code);
};
