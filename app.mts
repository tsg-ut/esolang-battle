/*
 * Module dependencies.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import chalk from 'chalk';
import compression from 'compression';
import MongoStore from 'connect-mongo';
import errorHandler from 'errorhandler';
import express from 'express';
import flash from 'express-flash';
import Router from 'express-promise-router';
import session from 'express-session';
import {check} from 'express-validator';
import lusca from 'lusca';
import mongoose from 'mongoose';
import logger from 'morgan';
import multer from 'multer';
import passport from 'passport';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

/*
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
import 'dotenv-expand/config';

/*
 * API keys and Passport configuration.
 */
import passportConfig from './config/passport.js';

/*
 * Controllers (route handlers).
 */
import apiController from './controllers/api.js';
import contestController from './controllers/contest.js';
import homeController from './controllers/home.js';
import submissionController from './controllers/submission.js';
import userController from './controllers/user.js';

import { sassMiddleware } from './lib/sass-middleware.js';
import io from './lib/socket-io.js';

import { webpackConfigGenerator } from './webpack.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * Build-up Webpack compiler
 */

const nodeEnv = process.env.NODE_ENV;
let webpackConfig: webpack.Configuration | null = null;
if (nodeEnv) {
	if (nodeEnv != "production" && nodeEnv != "development" && nodeEnv != "none") {
		throw "You must set a correct value to NODE_ENV.";
	}
	webpackConfig = webpackConfigGenerator({}, { mode: nodeEnv });
}
else {
	webpackConfig = webpackConfigGenerator({});
}
const compiler = webpack(webpackConfig);

const upload = multer({
	limits: {
		fieldSize: 100 * 1024 * 1024,
	},
});

/*
 * Create Express server.
 */
const app = express();

const apiKey = process.env.API_KEY || crypto.randomBytes(64).toString('hex');

/*
 * Connect to MongoDB.
 */
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
mongoose.connection.on('error', () => {
	throw new Error(
		`${chalk.red(
			'✗',
		)} MongoDB connection error. Please make sure MongoDB is running.`,
	);
});

/*
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(compression());
app.use(sassMiddleware);
app.use(
	webpackDevMiddleware(compiler, {publicPath: webpackConfig.output.publicPath}),
);
if (process.env.NODE_ENV === 'development') {
	app.use(webpackHotMiddleware(compiler));
}
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(upload.fields([{name: 'file', maxCount: 1}]));
app.use(
	session({
		resave: true,
		saveUninitialized: true,
		secret: process.env.SESSION_SECRET,
		store: MongoStore.create({
			mongoUrl: process.env.MONGODB_URI || process.env.MONGOLAB_URI,
		}),
	}),
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
	lusca.csrf({
		blocklist: ['/api/execution'],
	})(req, res, next);
});
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.use(async (req, res, next) => {
	const hash = await fs.readFile(path.resolve(__dirname, '.git/refs/heads/master'))
		.catch(() => Math.floor(Math.random() * 1e10));

	res.locals.user = req.user;
	res.locals.hash = hash.toString().trim();
	res.locals.env = process.env.NODE_ENV;

	next();
});
app.use((req, res, next) => {
	// After successful login, redirect back to the intended page
	if (
		!req.user &&
		req.path !== '/login' &&
		req.path !== '/signup' &&
		!req.path.match(/^\/auth/) &&
		!req.path.match(/\./)
	) {
		req.session.returnTo = req.path;
	} else if (req.user && req.path === '/account') {
		req.session.returnTo = req.path;
	}
	next();
});
app.use(express.static(path.join(__dirname, 'public'), {maxAge: 0}));

/*
 * Primary app routes.
 */
const router = Router();
router.get('/', homeController.index);
router.get('/login', userController.getLogin);
router.get('/logout', userController.logout);
router.get(
	'/account',
	passportConfig.isAuthenticated,
	userController.getAccount,
);
router.get(
	'/contests/:contest',
	contestController.base,
	contestController.index,
);
router.get(
	'/contests/:contest/rule',
	contestController.base,
	contestController.rule,
);
router.get(
	'/contests/:contest/submissions',
	contestController.base,
	submissionController.getSubmissions,
);
router.get(
	'/contests/:contest/submissions/:submission',
	contestController.base,
	submissionController.getSubmission,
);
router.get(
	'/contests/:contest/submissions/:submission/raw',
	contestController.base,
	submissionController.getRawSubmission,
);
router.get(
	'/contests/:contest/admin',
	passportConfig.isAuthenticated,
	contestController.base,
	contestController.getAdmin,
);
router.get(
	'/contests/:contest/check',
	passportConfig.isAuthenticated,
	contestController.base,
	contestController.getCheck,
);

router.get('/submissions/:submission', submissionController.getOldSubmission);

router.post(
	'/api/execution',
	check('token', 'Please specify valid token').equals(apiKey),
	apiController.postExecution,
);
router.get(
	'/api/contests/:contest/submission',
	passportConfig.isAuthenticated,
	apiController.contest,
	apiController.getSubmission,
);
router.post(
	'/api/contests/:contest/submission',
	check('language', 'Please Specify language').exists(),
	passportConfig.isAuthenticated,
	apiController.contest,
	apiController.postSubmission,
);
router.post(
	'/api/contests/:contest/execution',
	check('language', 'Please Specify language').exists(),
	passportConfig.isAuthenticated,
	apiController.contest,
	apiController.postContestExecution,
);
router.get(
	'/api/contests/:contest/languages',
	apiController.contest,
	apiController.getLanguages,
);

/*
 * OAuth authentication routes. (Sign in)
 */
router.get('/auth/twitter', passport.authenticate('twitter'));
router.get(
	'/auth/twitter/callback',
	passport.authenticate('twitter', {failureRedirect: '/login'}),
	(req, res) => {
		res.redirect(req.session.returnTo || '/');
	},
);

app.use(router);

/*
 * Error Handler.
 */
if (process.env.NODE_ENV === 'development') {
	app.use(errorHandler());
}

/*
 * Start Express server.
 */
const server = app.listen(app.get('port'), () => {
	console.log(
		'%s App is running at http://localhost:%d in %s mode',
		chalk.green('✓'),
		app.get('port'),
		app.get('env'),
	);
	console.log('  Press CTRL-C to stop\n');
});

io.default.attach(server);

export default app;
