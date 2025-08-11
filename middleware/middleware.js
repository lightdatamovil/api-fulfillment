function validateData(data) {
    const datePattern = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const key in data) {
        if (typeof data[key] === 'object' && !Array.isArray(data[key]) && data[key] !== null) {
            validateData(data[key]);
        } else if (typeof data[key] === 'string') {
            if (key.includes("fecha") && !datePattern.test(data[key])) {
                throw new Error(`El campo "${key}" no tiene un formato de fecha válido.`);
            }
            if (key.includes("email") && !emailPattern.test(data[key])) {
                throw new Error(`El campo "${key}" no tiene un formato de correo válido.`);
            }
            const specialCharPattern = /[^a-zA-Z0-9\s.,\-:ñÑ]/;
            if (specialCharPattern.test(data[key])) {
                throw new Error(`El campo "${key}" contiene caracteres especiales no permitidos.`);
            }
        }
    }
}

module.exports = validateData
