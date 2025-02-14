import logger from '../../utils/logger';
import onChainConfig from '../../config/onChainConfig';
import { getBalances, getWallet } from 'xtreamly_trader';
import { AaveActions } from 'xtreamly_trader';

export interface DepositParams {
	amount: string; // Amount in Ether as a string, e.g., "1.0"
}

export const deposit_eth = async (amount: string): Promise<void> => {
	try {
		let txn_amount = Number(amount);
		const wallet = getWallet();
		const aaveActions = new AaveActions(wallet);

		aaveActions.depositETH(txn_amount);

		logger.info('Deposit action executed', { txn_amount });
	} catch (error: any) {
		logger.error('Error in supply service', {
			error: error.message,
			stack: error.stack,
		});
		throw error; // Propagate the error to be caught in executeOnChainAction
	}
};
