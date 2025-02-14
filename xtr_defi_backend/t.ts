import { getBalances, getWallet } from 'xtreamly_trader';

async function main() {
	const wallet = getWallet();
	const r = await getBalances(wallet.address as `0x${string}`);
	console.log(r);
}

main().catch(console.error);
