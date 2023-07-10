import lodash from 'lodash';
import passport from 'passport';
import {Strategy as TwitterStrategy} from 'passport-twitter';
import {NextFunction, Request, Response} from 'express';

import User from '../models/User';

const colors = [
	'#777777',
	'#b80000',
	'#1273de',
	'#fccb00',
	'#5300eb',
	'#006b76',
	'#db3e00',
	'#004dcf',
	'#008b02',
];

passport.serializeUser((user, done) => {
	done(null, user.id);
});

passport.deserializeUser((id, done) => {
	User.findById(id)
		.then((user) => {
			done(null, user);
		})
		.catch((error) => {
			done(error, null);
		});
});

// Sign in with Twitter.

passport.use(
	new TwitterStrategy(
		{
			consumerKey: process.env.TWITTER_KEY,
			consumerSecret: process.env.TWITTER_SECRET,
			callbackURL: `${process.env.SERVER_ORIGIN}/auth/twitter/callback`,
			passReqToCallback: true,
		},
		// eslint-disable-next-line max-params
		async (req, accessToken, tokenSecret, profile, done) => {
			try {
				if (req.user) {
					const existingUser = await User.findOne({twitter: profile.id});

					if (existingUser) {
						req.flash(
							'errors',
							'There is already a Twitter account that belongs to you. Sign in with that account or delete it, then link it with your current account.'
						);
						done(null, req.user);
						return;
					}

					const user = await User.findById(req.user.id);

					user.twitter = profile.id;
					user.tokens.push({kind: 'twitter', accessToken, tokenSecret});
					user.profile.name = user.profile.name || profile.displayName;
					user.profile.location =
						user.profile.location || profile._json.location;
					user.profile.picture =
						user.profile.picture || profile._json.profile_image_url_https;

					await user.save();
					req.flash('info', 'Twitter account has been linked.');
					done(null, user);
				} else {
					const existingUser = await User.findOne({twitter: profile.id});
					if (existingUser) {
						done(null, existingUser);
						return;
					}

					const count = User.count({});
					const user = new User();

					// Twitter will not provide an email address.  Period.
					// But a person’s twitter username is guaranteed to be unique
					// so we can "fake" a twitter email address as follows:
					user.email = `${profile.username}@twitter.com`;
					user.twitter = profile.id;
					user.tokens.push({kind: 'twitter', accessToken, tokenSecret});
					user.profile.name = profile.displayName;
					user.profile.location = profile._json.location;
					user.profile.picture = profile._json.profile_image_url_https;
					await user.save();

					done(null, user);
				}
			} catch (error) {
				if (error) {
					done(error);
				}
			}
		}
	)
);

/*
 * Login Required middleware.
 */
export function isAuthenticated(
	req: Request,
	res: Response,
	next: NextFunction
) {
	if (req.isAuthenticated()) {
		next();
		return;
	}
	res.redirect('/login');
}

/*
 * Authorization Required middleware.
 */
export function isAuthorized(req: Request, res: Response, next: NextFunction) {
	const provider = req.path.split('/').slice(-1)[0];

	if (lodash.find(req.user.tokens, {kind: provider})) {
		next();
		return;
	}

	res.redirect(`/auth/${provider}`);
}
