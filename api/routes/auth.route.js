import { Router } from "express";
import { companiesService } from "../db.js";
import { login } from "../controller/auth/login.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const auth = Router();

auth.post(
    '/login',
    buildHandlerWrapper({
        required: ['username', 'password', 'companyCode'],
        companyResolver2: async ({ req }) => {
            const { companyCode } = req.body;
            const company = await companiesService.getByCode(companyCode);
            return company;
        },
        controller: async ({ req, db }) => await login({ db, req }),
    })
);

// auth.get(
//     '/company-identification/:companyCode',
//     buildHandlerWrapper({
//         requiredParams: ['companyCode'],
//         companyResolver2: async ({ req }) => {
//             const { companyCode } = req.params;
//             const company = await companiesService.getByCode(companyCode);
//             return company;
//         },
//         controller: async ({ company }) => {
//             const result = await identification(company);
//             return result;
//         },
//     })
// );

// auth.get(
//     '/login-app',
//     buildHandlerWrapper({
//         required: ['username', 'password', 'companyId'],
//         controller: async ({ db, req }) => {
//             const result = await loginApp(db, req);
//             return result;
//         },
//     })
// );

export default auth;
