// lockLocal.js
const locks = new Map();

export function tryLockOrderLocal(sellerId, orderNumber, ttlSec = 30) {
    const key = `ff_lock_${sellerId}_${orderNumber}`;

    const now = Date.now();

    // Si el lock existe y no expiró → NO adquirimos lock
    const expiresAt = locks.get(key);
    if (expiresAt && expiresAt > now) {
        return false;
    }

    // Crear el lock con expiración
    locks.set(key, now + ttlSec * 1000);

    // Programar limpieza automática (opcional)
    setTimeout(() => {
        const storedExp = locks.get(key);
        if (storedExp && storedExp <= Date.now()) {
            locks.delete(key);
        }
    }, ttlSec * 1000);

    return true;
}
