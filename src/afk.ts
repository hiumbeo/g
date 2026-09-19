
const afkUsers = new Map<string, { reason: string, timestamp: number }>();

export function setAfk(userId: string, reason: string) {
    afkUsers.set(userId, { reason, timestamp: Date.now() });
}

export function getAfk(userId: string) {
    return afkUsers.get(userId);
}

export function removeAfk(userId: string) {
    afkUsers.delete(userId);
}
