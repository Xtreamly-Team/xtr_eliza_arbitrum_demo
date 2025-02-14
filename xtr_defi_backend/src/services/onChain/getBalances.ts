// src/services/onChain/supply.ts

import { ethers } from 'ethers';
import logger from '../../utils/logger';
import onChainConfig from '../../config/onChainConfig';
import { getBalances, getWallet } from 'xtreamly_trader';

// export interface GetBalanceParams {
// 	account: string; // Amount in Ether as a string, e.g., "1.0"
// }

export const getBalance = async (): Promise<void> => {
	try {
		// Implement your supply logic here using bigAmount
		// For example, interacting with a smart contract:
		/*
        const contract = new ethers.Contract(contractAddress, abi, signer);
        const tx = await contract.supply(bigAmount);
        await tx.wait();
        */

		const wallet = getWallet();

		const r = await getBalances(wallet.address as `0x${string}`);
		console.log(r);

		logger.info('Called getBalances action executed', { wallet });
	} catch (error: any) {
		logger.error('Error in supply service', {
			error: error.message,
			stack: error.stack,
		});
		throw error; // Propagate the error to be caught in executeOnChainAction
	}
};
