import axios from 'axios';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';
import dotenv from 'dotenv';
import { cleanEnv, str } from 'envalid';
import { a } from 'framer-motion/client';

dotenv.config();

// Validate environment variables
const env = cleanEnv(process.env, {
	ENSO_API_KEY: str(),
	PRIVATE_KEY: str(),
	ARBITRUM_RPC_MAINNET_RPC: str(),
});

let RPC_URL = env.ARBITRUM_RPC_MAINNET_RPC;
const apiKey = env.ENSO_API_KEY;
const privateKey = env.PRIVATE_KEY;

const account = privateKeyToAccount(privateKey as `0x${string}`);

// Create a public client for interacting with the Ethereum network
const publicClient = createPublicClient({
	chain: arbitrum,
	transport: http(RPC_URL),
});

// Create a wallet client for signing transactions
const walletClient = createWalletClient({
	chain: arbitrum,
	transport: http(RPC_URL),
	account: account,
});

// ERC20 approve transaction using viem
const erc20Abi = [
	{
		inputs: [
			{ name: 'spender', type: 'address' },
			{ name: 'amount', type: 'uint256' },
		],
		name: 'approve',
		outputs: [{ name: '', type: 'bool' }],
		stateMutability: 'nonpayable',
		type: 'function',
	},
] as const;

// let depositAmount = parseUnits("5", 6); // 5 USDC (USDC has 6 decimals)
// let approvalAmount = BigInt(parseUnits("500000", 6).toString()); // Set a sufficient approval amount



const USDC_ADDRESS = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';
const USDT_ADDRESS = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
const aUSDC_ADDRESS = '0x724dc807b04555b71ed48a6896b6F41593b8C637';

const outaUSDC_ADDRESS = '0x625e7708f30ca75bfd92586e17077590c60eb4cd';
const AAVE_V3_POOL_ADDRESS = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';

const WETH_ADDRESS = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';


export async function deleverageLoopUSDC_ETH(_withdrawAmount: string) {

	let depositAmount = '400000'; // 10 USDC (USDC has 6 decimals) - manually calculated: 10 * 10^6
	let approvalAmount = BigInt(parseUnits('1000000000000', 6).toString()); // Set to 10 USDC
	// let borrowAmount = (Number(depositAmount) * 0.5).toString();
	// use this amount for more visibility in the txn
	// let borrowAmount = '100000000000000';

	let borrowAmount = "10000"
	let repayAmount = "10000"
	let withdrawAmount = _withdrawAmount;

	try {
		// Your existing code that uses await
		const response = await axios.get(
			'https://api.enso.finance/api/v1/wallet?' +
				'chainId=42161&' +
				`fromAddress=${account.address}`,
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`,
				},
			}
		);
		console.log('Wallet Info:', JSON.stringify(response.data, null, 2));
	} catch (error) {
		console.error('Error getting wallet info:', error);
		process.exit(1);
	}

	let ensoWallet = '0x80EbA3855878739F4710233A8a19d89Bdd2ffB8E';

	///! Approve USDT
	try {
		const approveTx = await walletClient.writeContract({
			address: USDT_ADDRESS, // USDT UNDERLYING ADDRESS
			abi: erc20Abi,
			functionName: 'approve',
			args: [
				ensoWallet as `0x${string}`,
				approvalAmount, // Ensure this is enough to cover the transfer
			],
		});
		console.log('Approval transaction hash:', approveTx);

		// Wait for the approval transaction to be mined
		const approvalReceipt = await publicClient.waitForTransactionReceipt({
			hash: approveTx,
		});
		// console.log('Approval Transaction Receipt:', approvalReceipt);
	} catch (error) {
		console.error('Error in approval transaction:', error);
		process.exit(1);
	}
	///! Approve WETH
	try {
		const approveTx = await walletClient.writeContract({
			address: WETH_ADDRESS, // USDT UNDERLYING ADDRESS
			abi: erc20Abi,
			functionName: 'approve',
			args: [
				ensoWallet as `0x${string}`,
				approvalAmount, // Ensure this is enough to cover the transfer
			],
		});
		console.log('Approval transaction hash:', approveTx);

		// Wait for the approval transaction to be mined
		const approvalReceipt = await publicClient.waitForTransactionReceipt({
			hash: approveTx,
		});
		// console.log('Approval Transaction Receipt:', approvalReceipt);
	} catch (error) {
		console.error('Error in approval transaction:', error);
		process.exit(1);
	}

	// Get approval data from Enso API
	//! Approve USDT
	try {
		const responseApprove = await axios.get(
			'https://api.enso.finance/api/v1/wallet/approve?' +
				'chainId=42161&' +
				`fromAddress=${account.address}&` +
				`tokenAddress=${USDT_ADDRESS}&` + // USDT on Arbitrum
				`amount=${depositAmount}`,
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`,
				},
			}
		);
		console.log(
			'Approval Info:',
			JSON.stringify(responseApprove.data, null, 2)
		);
	} catch (error) {
		console.error('Error getting approval info:', error);
		if (axios.isAxiosError(error)) {
			console.error('Response data:', error.response?.data);
		}
		process.exit(1);
	}

	//! Deposit USDT
	//! Token OUT should be the correct USDC ADDRESS
	try {
		// Define the request body
		const requestBody = [
			{
				"protocol": "enso",
				"action": "route",
				"args": {
						"tokenIn": USDT_ADDRESS,
						"tokenOut": WETH_ADDRESS,
						"amountIn":  withdrawAmount,
						"slippage": "300"
				}
		},
		{
				protocol: "aave-v3",
				action: "repay",
				args: {
						tokenIn: WETH_ADDRESS,
						amountIn:  {
														"useOutputOfCallAt": 0
												},
						primaryAddress: AAVE_V3_POOL_ADDRESS,
				}
		}, 
		// {
		//     protocol: "aave-v3",
		//     action: "redeem",
		//     args: {
		//         tokenIn: aUSDC_ADDRESS,
		//         tokenOut: USDC_ADDRESS,
		//         amountIn: withdrawAmount,
		//         primaryAddress: AAVE_V3_POOL_ADDRESS,
		//         receiver: account.address,
		//     }
		// },
		// {
		//     protocol: "aave-v3",
		//     action: "deposit",
		//     args: {
		//         primaryAddress: AAVE_V3_POOL_ADDRESS, // Aave V3 Pool
		//         tokenIn: USDC_ADDRESS, // USDC
		//         tokenOut: outaUSDC_ADDRESS, // aUSDC (receipt token)
		//         amountIn:  {
		//             "useOutputOfCallAt": 2
		//         }
		//     }
		// },
		// {
		//     protocol: "aave-v3",
		//     action: "borrow",
		//     args: {
		//         collateral: USDC_ADDRESS,
		//         tokenOut: WETH_ADDRESS, // WETH
		//         amountOut: borrowAmount,
		//         primaryAddress: AAVE_V3_POOL_ADDRESS, // Aave V3 Pool
		//     }
		// },
		// {
		//     protocol: "uniswap-v3",
		//     action: "swap",
		//     args: {
		//         tokenIn: USDT_ADDRESS,
		//         tokenOut: USDC_ADDRESS,
		//         amountIn: borrowAmount,
		//         primaryAddress: UNISWAP_V3_POOL_ADDRESS, // Uniswap V3 Pool
		//         receiver: ensoWallet, 
		//         slippage: "300"
		//     }
		// }

		// // ROUTE 2: WETH -> USDC -> aUSDC -> WETH
		// {
		//     protocol: "enso",
		//     action: "route",
		//     args: {
		//         tokenIn: WETH_ADDRESS,
		//         tokenOut: USDC_ADDRESS,
		//         amountIn: borrowAmount,
		//         slippage: "300"
		//     }
		// },
		// {
		//     protocol: "aave-v3",
		//     action: "deposit",
		//     args: {
		//         primaryAddress: AAVE_V3_POOL_ADDRESS, // Aave V3 Pool
		//         tokenIn: USDC_ADDRESS, // USDC
		//         tokenOut: aUSDC_ADDRESS, // aUSDC (receipt token
		//         amountIn:  {
		//             "useOutputOfCallAt": 3
		//         }
		//     }
		// },
		// EXTEND THIS WITH ALTERNATIVE ROUTES
		// {
		//     "protocol": "enso",
		//     "action": "call",
		//     "args": {
		//         "address": outaUSDC_ADDRESS,
		//         "method": "transfer",
		//         "abi": "function transfer(address,uint256) external",
		//         "args": [
		//             "0xf2873F92324E8EC98a82C47AFA0e728Bd8E41665",
		//             {
		//                 "useOutputOfCallAt": 3
		//             }
		//         ]
		//     }
		// }
		];

		try {
			// Make the API request using Axios
			const response = await axios.post(
				'https://api.enso.finance/api/v1/shortcuts/bundle?' +
					'chainId=42161&' +
					'fromAddress=0xf2873F92324E8EC98a82C47AFA0e728Bd8E41665&' +
					'receiver=0xf2873F92324E8EC98a82C47AFA0e728Bd8E41665&' +
					'spender=0xf2873F92324E8EC98a82C47AFA0e728Bd8E41665',
				requestBody,
				{
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${apiKey}`, // Ensure the API key is included
					},
				}
			);

			console.log('API Response:', response.data);
			try {
				// Assuming the response contains the transaction data
			} catch (error) {
				console.error('Error getting transaction data:', error);
				process.exit(1);
			}
			const transactionData = response.data.tx.data; // Adjust this based on the actual response structure
			const toData = '0x80EbA3855878739F4710233A8a19d89Bdd2ffB8E';

			// Log the transaction data for debugging

			// Get current gas price and set a buffer
			// const gasPrice = await publicClient.getGasPrice();
			// const adjustedGasPrice = BigInt(Math.floor(Number(gasPrice) * 1.5)); // 50% buffer

			// Estimate gas for the transaction
			// const estimatedGas = await publicClient.estimateGas({
			//     to: toData,
			//     data: transactionData,
			//     value: parseUnits("0.000001", 18),
			// });

			// Convert estimatedGas to bigint and add a buffer
			// const gasLimit = BigInt(estimatedGas) * BigInt(2); // Add a buffer to the estimated gas

			// Create a transaction object
			const tx = {
				data: transactionData,
				from: account.address,
				to: toData as `0x${string}`,
				value: parseUnits('0.000000', 18),
			};

			// Log the transaction object for debugging
			// console.log("Transaction Object:", transactionData);

			// Sign and send the transaction
			const txResponse = await walletClient.sendTransaction(tx);
			console.log('Transaction Response:', txResponse);

			// Wait for the transaction to be mined
			const receipt = await publicClient.waitForTransactionReceipt({
				hash: txResponse,
			});
			// console.log('Transaction Receipt:', receipt);
		} catch (error) {
			console.error('Error sending transaction:', error);
			if (error instanceof Error) {
				console.error('Error message:', error.message);
				// Check if error has additional properties
				const txError = error as { code?: string; reason?: string };
				if (txError.code) {
					switch (txError.code) {
						case 'INSUFFICIENT_FUNDS':
							console.error(
								'Error: Insufficient funds to cover gas and value. Please ensure your wallet has enough ETH.'
							);
							break;
						case 'UNPREDICTABLE_GAS_LIMIT':
							console.error(
								'Error: Unable to estimate gas. The transaction may fail or the contract may be reverting.'
							);
							break;
						case 'NONCE_EXPIRED':
							console.error(
								'Error: Transaction nonce is too low. Another transaction may have been sent from this account.'
							);
							break;
						case 'REPLACEMENT_UNDERPRICED':
							console.error(
								'Error: Gas price too low to replace pending transaction. Increase gas price or wait for pending tx.'
							);
							break;
						case 'TRANSACTION_REPLACED':
							console.error(
								'Error: Transaction was replaced by another with higher gas price.'
							);
							break;
						default:
							console.error(
								'Error code:',
								txError.code,
								'- Please check transaction parameters and network status.'
							);
					}
				}
				if (txError.reason) {
					console.error('Error reason:', txError.reason);
				}
			}
		}
	} catch (error) {
		//     console.error('\nEnso API Error:');
		//     if (axios.isAxiosError(error)) {
		//         console.error('Message:', error.message);
		//         console.error('Stack:', error.stack);
		//         console.error('Response:', error.response?.data);
		//     } else {
		//         console.error('Details:', error);
		//     }
		//     console.error('\nPlease verify:');
		//     console.error('- Addresses are valid');
		//     console.error('- Token contracts exist on chain\n');
	}
}
// Run the main function
// leverageLoopUSDC_ETH();
