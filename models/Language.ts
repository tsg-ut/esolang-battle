import mongoose from 'mongoose';
import { ContestInfo } from './Contest';
import { SubmissionInfo } from './Submission';

const languageSchema = new mongoose.Schema(
	{
		solution: {type: mongoose.Schema.Types.ObjectId, ref: 'Submission'},
		contest: {type: mongoose.Schema.Types.ObjectId, ref: 'Contest'},
		oldId: {type: String},
		slug: {type: String},
	},
	{timestamps: true},
);

export interface LanguageMethods extends mongoose.Document { }

export interface LanguageInfo extends LanguageMethods {
	solution: SubmissionInfo,
	contest: ContestInfo,
	oldId: string,
	slug: string,
	createdAt: Date,
}

const Language = mongoose.model<LanguageInfo>('Language', languageSchema);

export default Language;
