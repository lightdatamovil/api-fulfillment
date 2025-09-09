import { Router } from "express";
import { companiesService } from "../db.js";
import { loginApp } from "../controller/auth/login_app.js";
import { loginWeb } from "../controller/auth/login_web.js";
import { identification } from "../controller/auth/identification.js";
import { buildHandler } from "./_handler.js";

const auth = Router();

auth.get(
    '/company-identification/:companyCode',
    buildHandler({
        requiredParams: ['companyCode'],
        needsDb: false,
        companyResolver: async ({ req }) => {
            const { companyCode } = req.params;
            const company = await companiesService.getByCode(companyCode);
            return company;
        },
        controller: async ({ company }) => {
            const result = await identification(company);
            return result;
        },
    })
);

auth.get(
    '/login-app',
    buildHandler({
        required: ['username', 'password', 'companyId'],
        controller: async ({ db, req }) => {
            const result = await loginApp(db, req);
            return result;
        },
    })
);

auth.get(
    '/login-web',
    buildHandler({
        required: ['username', 'password', 'companyCode'],
        controller: async ({ db, req }) => {
            const result = await loginWeb(db, req);
            return result;
        },
    })
);

export default auth;
