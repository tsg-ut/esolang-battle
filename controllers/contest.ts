import qs from 'querystring';
import classnames from 'classnames';
import MarkdownIt from 'markdown-it';
import {getLanguageMap} from '../controllers/utils';
import Contest from '../models/Contest';
import User from '../models/User';
import {NextFunction, Request, Response} from 'express';

/*
 * Middleware for all /contest/:contest routes
 */
export async function base(req: Request, res: Response, next: NextFunction) {
	const contest = await Contest.findOne({id: req.params.contest});

	if (!contest) {
		res.sendStatus(404);
		return;
	}

	req.contest = contest;
	next();
}

/*
 * GET /
 * Home page.
 */
export async function index(req: Request, res: Response) {
	const languageMap = await getLanguageMap({contest: req.contest});
	res.render('contest', {
		title: '',
		contest: req.contest,
		languageMap,
		classnames,
		hideFooter: true,
	});
}

export function rule(req: Request, res: Response) {
	const markdown = new MarkdownIt();
	res.render('rule', {
		contest: req.contest,
		title: 'Rule',
		description: {
			ja: markdown.render(req.contest.description.ja),
			en: markdown.render(req.contest.description.en),
		},
	});
}

/*
 * GET /contest/:contest/admin
 */
export async function getAdmin(req: Request, res: Response) {
	if (!req.user.admin) {
		res.sendStatus(403);
		return;
	}

	if (req.query.user && req.query.team) {
		const user = await User.findOne({_id: req.query.user});
		user.setTeam(
			req.contest,
			parseInt(req.query.team as string) as 0 | 1 | 2 | 3 | 4
		);
		await user.save();
		res.redirect(`/contests/${req.params.contest}/admin`);
		return;
	}

	const users = await User.find();

	res.render('admin', {
		contest: req.contest,
		users,
		teams: ['Red', 'Blue', 'Green', 'Orange', 'Purple'],
		colors: ['#ef2011', '#0e30ec', '#167516', '#f57f17', '#6a1b9a'],
		qs,
	});
}

/*
 * GET /contest/:contest/check
 */
export async function getCheck(req: Request, res: Response) {
	if (!req.contest.isOpen()) {
		res.redirect(`/contests/${req.contest.id}`);
		return;
	}

	const languages = await getLanguageMap({contest: req.contest});
	const availableLanguages = languages
		.filter(({type}) => type === 'language')
		.sort(({name: nameA}, {name: nameB}) => nameA.localeCompare(nameB));

	res.render('check', {
		title: 'Check',
		contest: req.contest,
		availableLanguages,
	});
}
