export const gameMarketplace = new Proxy({}, { get() { throw new Error('gameMarketplace has been removed. Feature disabled.') } })
