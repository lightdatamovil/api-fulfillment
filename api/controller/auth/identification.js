import { CustomException, Status } from "lightdata-tools";

export async function identification(company) {

    if (!company || company.did === undefined) {
        const error = new CustomException({
            title: 'Error en identificación',
            message: 'ID de compañía no definido',
            status: Status.internalServerError
        });
        throw error;
    }

    const result = {
        success: true,
        message: "Empresa identificada correctamente",
        data: {
            id: company.did * 1,
            image: '',
            // plan: company.plan * 1,
            // url: company.url,
            // country: company.pais * 1,
            // name: company.empresa,
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };

    return result;
}

