import {Request, Response} from 'express';

/*
 * GET /login
 * Login page.
 */
export function getLogin(req: Request, res: Response) {
	if (req.user) {
		res.redirect('/');
		return;
	}
	res.render('account/login', {
		title: 'Login',
	});
}

/*
 * GET /logout
 * Log out.
 */
export function logout(req: Request, res: Response) {
	req.logout((error) => {
		if (!error) {
			res.redirect('/');
		}
	});
}

/*
 * GET /account
 * Profile page.
 */
export function getAccount(req: Request, res: Response) {
	res.render('account/profile', {
		title: 'Account Management',
	});
}
