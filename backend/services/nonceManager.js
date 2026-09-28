/**
 * @file nonceManager.js
 * @notice Enterprise Relayer Mutex & Nonce Synchronization Queue
 * @dev Enforces strictly sequential Ethereum transaction execution, preventing nonce collisions and dropped transactions.
 */

class NonceManager {
    constructor() {
        this.queue = Promise.resolve();
        this.currentNonce = null;
        this.wallet = null;
    }

    /**
     * Initializes the manager with the relayer wallet and retrieves current on-chain nonce.
     */
    async init(wallet) {
        this.wallet = wallet;
        this.currentNonce = await wallet.getNonce('pending');
        console.log(`[NonceManager] Initialized for ${wallet.address} at nonce ${this.currentNonce}`);
    }

    /**
     * Executes a transaction task inside a strictly serialized queue.
     * @param {Function} task - Async function receiving the current nonce: async (nonce) => { tx }
     * @returns {Promise<any>}
     */
    enqueue(task) {
        return new Promise((resolve, reject) => {
            this.queue = this.queue
                .then(async () => {
                    try {
                        if (this.currentNonce === null) {
                            this.currentNonce = await this.wallet.getNonce('pending');
                        }
                        const assignedNonce = this.currentNonce;
                        const result = await task(assignedNonce);
                        this.currentNonce++;
                        resolve(result);
                    } catch (error) {
                        // On error, resync nonce with the blockchain to recover cleanly
                        try {
                            this.currentNonce = await this.wallet.getNonce('pending');
                        } catch (syncErr) {
                            console.error('[NonceManager] Error resyncing nonce:', syncErr.message);
                        }
                        reject(error);
                    }
                })
                .catch((err) => {
                    // Prevent queue chain breakdown
                    console.error('[NonceManager] Queue step error:', err.message);
                });
        });
    }
}

const nonceManager = new NonceManager();
module.exports = nonceManager;
