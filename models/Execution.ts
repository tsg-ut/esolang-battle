import mongoose from 'mongoose';
import {UserInfo} from './User';
import {LanguageInfo} from './Language';

const executionSchema = new mongoose.Schema(
	{
		user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
		language: {type: mongoose.Schema.Types.ObjectId, ref: 'Language'},
		code: Buffer,
		input: String,
		stdout: String,
		stderr: String,
		duration: Number,
	},
	{timestamps: true}
);

export interface ExecutionMethods extends mongoose.Document {}

export interface ExecutionInfo extends ExecutionMethods {
	user: UserInfo;
	language: LanguageInfo;
	code: Buffer;
	input: string;
	stdout: string;
	stderr: string;
	duration: number;
	createdAt: Date;
}

const Execution = mongoose.model<ExecutionInfo>('Execution', executionSchema);

export default Execution;
