import { ethers } from 'ethers';
import logger from '../utils/logger';
import { executeOnChainAction } from '../services/transactionService';
import { TransactionParams } from '../types/TransactionTypes';
import { getFullAavePositionData, getTokenEOABalances } from './aaveV3Position';
import { leverageLoopUSDC_ETH } from './bundleLev_USDC_ETH';
import { deleverageLoopUSDC_ETH } from './bundleDeLev_USDC_ETH';
import {pushMessage} from "../utils/ui_pusher";

// Function to create a delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const determineAmount = (prediction: number): string => {
	const scaledAmount = Math.floor(prediction * 1e17).toString();
	return scaledAmount;
};

async function talkToEliza(promptData: any) {
	const text = JSON.stringify(promptData, null, 2);

	const response = await fetch('http://localhost:3000/Eliza/message', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			// text: 'should I increase or decrease my leverage? My collateral is 0.0814752 ETH and 20 USDC and borrow is 0,0000002 eth and 85.63 USDC and my health factor is at 2.37. should I buy more usdc, borrow more eth, repay eth or perform another action. Whatever action you recommend always define the action and amount in your response . marketData: predicted_at: 1738320856264, predicted_at_utc: 2025-01-31T10:54:16.264362+00:00,market_status: lowvol, market_status_description: ETH price in low price fluctuations enabling to take more risk.',
			text,
			userId: 'user',
			userName: 'User',
		}),
	});
	const data = await response.json();
	await delay(15000);
	return data
}

export async function handleApiResponse(data: any, chatId: string): Promise<void> {
	// Safely access nested properties with type checking


	// if (volPrediction === null || statePrediction === null) {
	// 	logger.error('Invalid or missing prediction data', { data });
	// 	return;
	// }


	logger.info('Received prediction data from xtreamly API');
	console.log(data);

	// console.log(volPrediction, statePrediction, 'this is the prediction data');


	// fetch user aave v3 position data

	const userAddress = '0xf2873f92324e8ec98a82c47afa0e728bd8e41665';
	await pushMessage(chatId, "loop", "Checking your current AAVE V3 Positions, for wallet" + userAddress)

	const aavePositionData = await getFullAavePositionData(userAddress);
	logger.info('Received aave v3 position data');
	console.log(aavePositionData);
	
	const ltv = aavePositionData.positionAnalysis.currentLTV * 100;
	await pushMessage(chatId, "loop", `
	Current AAVE Position Analysis:
	
	1. Current Loan-to-Value (LTV): ${ltv.toFixed(2)}% (Indicates that ${ltv.toFixed(2)}% of the collateral's value is being used as a loan)
	2. Risk Level: ${aavePositionData.positionAnalysis.riskLevel}
	3. Health Factor: ${aavePositionData.positionAnalysis.healthFactor.toFixed(2)} (A measure of how safe the position is; the higher, the safer)
	
	USDC (USD Coin) Data:
	
	1. Supplied: ${aavePositionData.usdcData.balances.supplied.toFixed(2)} USDC
	2. Supply APY (Annual Percentage Yield): ${(aavePositionData.usdcData.balances.supplied * 100).toFixed(4)}% (Interest earned on supplied USDC)
	
	WETH (Wrapped Ethereum) Data:
	
	1. Supplied: ${aavePositionData.wethData.balances.supplied.toFixed(2)} WETH
	2. Supply APY (Annual Percentage Yield): ${(aavePositionData.wethData.balances.supplied * 100).toFixed(4)}% (Interest earned on supplied WETH)
	`)

	let depositAmount = '400000';
	let borrowAmount = '100000000000000';
	let withdrawAmount = '10000';

	// Get token balances
	const tokenBalances = await getTokenEOABalances(userAddress);
	const balances = {
		USDC: tokenBalances.usdc.displayString,
		WETH: tokenBalances.weth.displayString
	};
	console.log('Token balances:', balances);
	await pushMessage(chatId, "loop", `
	You current token balances:
	
	1. USDC: ${balances.USDC}
	2. WETH: ${balances.WETH}
	`)

	// Simple threshold condition
	// Make request to Eliza API
	logger.info('Populating xtr_eliza with prompt');

	const question = 'Should I increase or decrease my leverage or maintain my current position?'
	const promptData = {
		question,
		currentPosition: {
			data: aavePositionData,
			EOAAvailableTokenBalances: {
				usdc: {
					USDC_Amount: tokenBalances.usdc.displayString
				},
				weth: {
					WETH_Amount: tokenBalances.weth.displayString
				}
			}
		},
		xtreamlyMarketVolatilityPrediction: {
			volatility_and_state: data,
		}, 
		available_actions: [
			{
				action: 'leverage',
				amount: depositAmount
			},
			{
				action: 'deleverage',
				amount: withdrawAmount
			},
			{
				action: 'hold',
				amount: '0'
			}
		]
	};


	logger.info('Prompt for Eliza:');
	console.log(JSON.stringify(promptData, null, 2));
	await pushMessage(chatId, "loop", `Hey Eliza, ${question}`)

	try {
		const data = await talkToEliza(promptData);

		// Access the first element of the array
		const elizaResponse = data[0]; // Assuming the response is an array
		const elizaAction = elizaResponse.action;
		const elizaAmount = elizaResponse.amount;

		// Log the extracted values
		logger.info('Eliza API Response:', {
			action: elizaAction,
			amount: elizaAmount,
		});
		elizaResponse.text && await pushMessage(chatId, "eliza", elizaResponse.text)
		await pushMessage(chatId, "eliza", `You should ${elizaAction} ${elizaAmount}.`)


		// Check if elizaAmount is valid
		// if (typeof elizaAmount !== 'number') {
		// 	logger.error('Invalid elizaAmount received:', elizaAmount);
		// 	return; // Exit if elizaAmount is not valid
		// }
		await pushMessage(chatId, "loop", `Perfect I will ${elizaAction} ${elizaAmount}.`)

		// leverageLoopUSDC_ETH(depositAmount, borrowAmount);

		// switch (elizaAction) {
		// 	case 'leverage':
		// 		logger.warn('Executing leverage operation on Aave:', {
		// 			action: 'leverage',
		// 			usdcAmount: elizaAmount,
		// 			borrowAmount: borrowAmount
		// 		});
		// 		await leverageLoopUSDC_ETH(elizaAmount, borrowAmount);
		// 		logger.info('Successfully executed leverage operation on Aave');
		// 		break;
		// 	case 'deleverage':
		// 		logger.warn('Executing deleverage operation on Aave:', {
		// 			action: 'deleverage', 
		// 			amount: elizaAmount
		// 		});
		// 		await deleverageLoopUSDC_ETH(elizaAmount);
		// 		logger.info('Successfully executed deleverage operation on Aave');
		// 		break;
		// 	case 'hold':
		// 		logger.warn('Executing hold operation:', {
		// 			action: 'hold',
		// 			amount: elizaAmount
		// 		});
		// 		logger.info('Successfully maintained current position - no action needed');
		// 		break;
		// 	default:
		// 		logger.error('Invalid action received from Eliza:', elizaAction);
		// }

		// Convert elizaAmount from smallest USDC unit (6 decimals) to string with decimal
		// amount = (elizaAmount / 1e6).toString(); // Ensure elizaAmount is treated as a number
		// console.log(amount, typeof amount, 'this is the amount for the txn');
		// // Deposit usdc
		// logger.info('SUPPLY USDC');
		// amount = elizaAmount;
		// Prepare TransactionParams with dynamic amount
		// Wait for the API response to complete

		// if (!elizaAction || !elizaAmount) {
		// 	logger.error('Failed to get required values from Eliza');
		// 	return;
		// }
	} catch (error: any) {
		await pushMessage(chatId, "loop", 'I am having trouble talking to Eliza at this moment.')
		logger.error('Error calling Eliza API:', {
			error: error.message,
			stack: error.stack,
		});
	}

	//===========================================
	// Next 2 lines determine leverage loop flow
	//===========================================

	// leverageLoopUSDC_ETH(depositAmount, borrowAmount);
	// deleverageLoopUSDC_ETH(withdrawAmount); 
	//===========================================
	//===========================================


	//===========================================
	// Single simple supply action call
	//===========================================
		// Wait for 20 seconds before proceeding

		// Prepare TransactionParams with dynamic amount
	// 	const transactionParams: TransactionParams = {
	// 		action: 'supply_usdc',
	// 		params: { amount }, // Ensure 'amount' is a string
	// 	};

	// 	try {
	// 		// Execute the on-chain action with dynamic parameters
	// 		await executeOnChainAction(transactionParams);
	// 		logger.info('On-chain supply action executed successfully.');
	// 	} catch (error: any) {
	// 		logger.error('Error executing on-chain supply action.', {
	// 			error: error.message,
	// 			stack: error.stack,
	// 		});
	// 	}
	// } catch (error: any) {
	// 	logger.error('Error calling Eliza API:', {
	// 		error: error.message,
	// 		stack: error.stack,
	// 	});
	// }

	//===========================================
	// Single simple supply action call
	//===========================================

	// if (prediction) {
	// 	logger.info('SUPPLY USDC');
	//     // Prepare TransactionParams with dynamic amount
	// 	const transactionParams: TransactionParams = {
	// 		action: 'supply_usdc',
	// 		params: { amount }, // Ensure 'amount' is a string
	// 	};

	// 	try {
	// 		// Execute the on-chain action with dynamic parameters
	// 		await executeOnChainAction(transactionParams);
	// 		logger.info('On-chain supply action executed successfully.');
	// 	} catch (error: any) {
	// 		logger.error('Error executing on-chain supply action.', {
	// 			error: error.message,
	// 			stack: error.stack,
	// 		});
	//     }
	// }
	//===========================================
	// Single simple getBalance action call
	//===========================================
	// if (prediction) {
	// 	logger.info('GET BALANCES');
	// 	// Prepare TransactionParams with dynamic amount
	// 	const transactionParams: TransactionParams = {
	// 		action: 'getBalance',
	// 		params: { amount }, // Ensure 'amount' is a string
	// 	};

	// 	try {
	// 		// Execute the on-chain action with dynamic parameters
	// 		await executeOnChainAction(transactionParams);
	// 		logger.info('On-chain supply action executed successfully.');
	// 	} catch (error: any) {
	// 		logger.error('Error executing on-chain supply action.', {
	// 			error: error.message,
	// 			stack: error.stack,
	// 		});
	// 	}
	// }
	//===========================================
	// Single simple withdraw action call
	//===========================================
	// if (prediction) {
	// 	logger.info('WITHDRAW ETH');
	//     // Prepare TransactionParams with dynamic amount
	// 	const transactionParams: TransactionParams = {
	// 		action: 'withdraw_eth',
	// 		params: { amount }, // Ensure 'amount' is a string
	// 	};

	// 	try {
	// 		// Execute the on-chain action with dynamic parameters
	// 		await executeOnChainAction(transactionParams);
	// 		logger.info('On-chain supply action executed successfully.');
	// 	} catch (error: any) {
	// 		logger.error('Error executing on-chain supply action.', {
	// 			error: error.message,
	// 			stack: error.stack,
	// 		});
	//     }
	// }
	//===========================================
	// Single simple depositETH action call
	//===========================================
	// if (prediction) {
	// 	logger.info('DEPOSIT ETH');
	//     // Prepare TransactionParams with dynamic amount
	// 	const transactionParams: TransactionParams = {
	// 		action: 'deposit_eth',
	// 		params: { amount }, // Ensure 'amount' is a string
	// 	};

	// 	try {
	// 		// Execute the on-chain action with dynamic parameters
	// 		await executeOnChainAction(transactionParams);
	// 		logger.info('On-chain supply action executed successfully.');
	// 	} catch (error: any) {
	// 		logger.error('Error executing on-chain supply action.', {
	// 			error: error.message,
	// 			stack: error.stack,
	// 		});
	//     }
	// }
	//===========================================
	// Single simple repayUSDC action call
	//===========================================
	// if (prediction) {
	// 	logger.info('REPAY USDC');
	//     // Prepare TransactionParams with dynamic amount
	// 	const transactionParams: TransactionParams = {
	// 		action: 'repay_usdc',
	// 		params: { amount }, // Ensure 'amount' is a string
	// 	};

	// 	try {
	// 		// Execute the on-chain action with dynamic parameters
	// 		await executeOnChainAction(transactionParams);
	// 		logger.info('On-chain supply action executed successfully.');
	// 	} catch (error: any) {
	// 		logger.error('Error executing on-chain supply action.', {
	// 			error: error.message,
	// 			stack: error.stack,
	// 		});
	//     }
	// }
	//===========================================	
	// Single simple borrowUSDC action call
	//===========================================
	// if (prediction) {
	// 	logger.info('BORROW USDC');
	//     // Prepare TransactionParams with dynamic amount
	// 	const transactionParams: TransactionParams = {
	// 		action: 'borrow_usdc',
	// 		params: { amount }, // Ensure 'amount' is a string
	// 	};

	// 	try {
	// 		// Execute the on-chain action with dynamic parameters
	// 		await executeOnChainAction(transactionParams);
	// 		logger.info('On-chain supply action executed successfully.');
	// 	} catch (error: any) {
	// 		logger.error('Error executing on-chain supply action.', {
	// 			error: error.message,
	// 			stack: error.stack,
	// 		});
	//     }
	// }

	//===========================================
	// Single simple withdrawUSDC action call
	//===========================================
	// if (prediction) {
	// 	logger.info('WITHDRAW USDC');
	//     // Prepare TransactionParams with dynamic amount
	// 	const transactionParams: TransactionParams = {
	// 		action: 'withdraw_usdc',
	// 		params: { amount }, // Ensure 'amount' is a string
	// 	};

	// 	try {
	// 		// Execute the on-chain action with dynamic parameters
	// 		await executeOnChainAction(transactionParams);
	// 		logger.info('On-chain supply action executed successfully.');
	// 	} catch (error: any) {
	// 		logger.error('Error executing on-chain supply action.', {
	// 			error: error.message,
	// 			stack: error.stack,
	// 		});
	//     }
	// }
	//===========================================
	//===========================================
	// if (low_volatility_signal && prediction > 0.0003) {
	// 	logger.info('Low volatility signal triggered. Executing transaction...', {
	// 		amount,
	// 	});

	// 	// Prepare TransactionParams with dynamic amount
	// 	const transactionParams: TransactionParams = {
	// 		action: 'supply_usdc',
	// 		params: { amount }, // Ensure 'amount' is a string
	// 	};

	// 	try {
	// 		// Execute the on-chain action with dynamic parameters
	// 		await executeOnChainAction(transactionParams);
	// 		logger.info('On-chain supply action executed successfully.', { amount });
	// 	} catch (error: any) {
	// 		logger.error('Error executing on-chain supply action.', {
	// 			error: error.message,
	// 			stack: error.stack,
	// 		});
	// 		// Handle error as needed (e.g., retry logic, alerts)
	// 	}
	// } else {
	// 	logger.info('No transaction triggered.');
	// }
}
