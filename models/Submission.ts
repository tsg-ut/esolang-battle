import moment from 'moment';
import mongoose from 'mongoose';
import {LanguageInfo} from './Language';
import {ContestInfo} from './Contest';
import {UserInfo} from './User';

const submissionSchema = new mongoose.Schema(
	{
		user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
		language: {type: mongoose.Schema.Types.ObjectId, ref: 'Language'},
		contest: {type: mongoose.Schema.Types.ObjectId, ref: 'Contest'},
		status: {
			type: String,
			enum: ['pending', 'failed', 'success', 'error', 'invalid'],
		},
		code: Buffer,
		size: {type: Number, min: 0},
		input: String,
		stdout: String,
		stderr: String,
		trace: String,
		disasm: String,
		duration: Number,
		url: String,
		error: {
			name: String,
			stack: String,
		},
	},
	{timestamps: true}
);

submissionSchema.methods.timeText = function () {
	return moment(this.createdAt).utcOffset(9).format('YYYY/MM/DD HH:mm:ss');
};

export interface SubmissionMethods extends mongoose.Document {
	timeText(): string;
}

export interface SubmissionInfo extends SubmissionMethods {
	user: UserInfo;
	language: LanguageInfo;
	contest: ContestInfo;
	status: 'pending' | 'failed' | 'success' | 'error' | 'invalid';
	code: Buffer;
	size: number;
	input: string;
	stdout: string;
	stderr: string;
	trace: string;
	disasm: string;
	duration: number;
	url: string;
	error: {
		name: string;
		stack: string;
	};
	createdAt: Date;
}

const Submission = mongoose.model<SubmissionInfo>(
	'Submission',
	submissionSchema
);

export default Submission;
