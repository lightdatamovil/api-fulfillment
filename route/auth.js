import { Router } from "express";
import { companiesService } from "../db.js";
import { loginApp } from "../controller/auth/login_app.js";
import { loginWeb } from "../controller/auth/login_web.js";
import { identification } from "../controller/auth/identification.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const auth = Router();

auth.get(
    '/company-identification/:companyCode',
    buildHandlerWrapper({
        requiredParams: ['companyCode'],
        companyResolver2: async ({ req }) => {
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
    buildHandlerWrapper({
        required: ['username', 'password', 'companyId'],
        controller: async ({ db, req }) => {
            const result = await loginApp(db, req);
            return result;
        },
    })
);

auth.get(
    '/login-web',
    buildHandlerWrapper({
        required: ['username', 'password', 'companyCode'],
        controller: async ({ db, req }) => {
            const result = await loginWeb(db, req);
            return result;
        },
    })
);

export default auth;
