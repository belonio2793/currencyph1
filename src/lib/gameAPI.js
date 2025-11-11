export const gameAPI = new Proxy({}, { get() { throw new Error('gameAPI has been removed. Feature disabled.') } })
