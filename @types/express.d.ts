import {Express, Request} from 'express';
import {ContestInfo} from '../models/Contest';
import {UserInfo} from '../models/User';
import {SessionData} from 'express-session';

declare global {
	namespace Express {
		interface Request {
			contest?: ContestInfo;
		}

		interface User extends UserInfo {}
	}
}

declare module 'express-session' {
	interface SessionData {
		returnTo: string;
	}
}
