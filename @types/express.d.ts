import { Express, Request } from "express"
import { ContestInfo } from "../models/Contest";
import { UserInfo } from "../models/User";

declare global {
    namespace Express {
        interface Request {
            contest?: ContestInfo;
        }

        interface User extends UserInfo { }
    }
}
