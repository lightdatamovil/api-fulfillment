import { companiesService, hostFulFillement, portFulFillement } from "../../db.js";
import { buildHandler, getFFProductionDbConfig } from "lightdata-tools";

export function buildHandlerWrapper({
    required,
    optional,
    headers,
    status,
    companyResolver2,
    getDbConfig2,
    controller,
    log,
    pool,
}) {
    return buildHandler({
        required,
        optional,
        headers,
        status,
        controller,
        companyResolver: companyResolver2 || (({ req }) => companiesService.getById(req.user.companyId)),
        getDbConfig: getDbConfig2 || (({ company }) => getFFProductionDbConfig(company, hostFulFillement, portFulFillement)),
        log,
        pool,
    });
}