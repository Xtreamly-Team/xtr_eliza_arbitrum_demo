import cron from 'node-cron';
import logger from '../utils/logger';
import { handleApiResponse } from '../scripts/xtrTraderPolicy';
import dotenv from 'dotenv';
import {Volatility, Horizons} from "xtreamly_trader";
import { pushMessage } from '../utils/ui_pusher';

dotenv.config(); // Ensure dotenv is configured to read .env variables

// Function to fetch data from the API
const fetchData = async (chatId: string) => {
	try {
		await pushMessage(chatId, "loop", "Let's take a look at Xtreamly's current volatility predictions...")

		// Make concurrent API calls
		const api = new Volatility()
		const [data, stateData] = await Promise.all([
			api.prediction(Horizons.min1, "ETH"),
			api.state("ETH"),
		]);

		// Log the data with variables attached
		const volPredictionLog = `Volatility prediction from xtreamly API: ${JSON.stringify(data)}`;
		const statePredictionLog = `State prediction from xtreamly API: ${JSON.stringify(stateData)}`;

		await pushMessage(chatId, "loop", `
		The Xtreamly volatility model predicted ${stateData.classification_description}.
		`)

		console.log(volPredictionLog);
		console.log(statePredictionLog);

		// Return or process the combined data as needed
		return { volPredictionLog, statePredictionLog };
	} catch (error: any) {
		await pushMessage(chatId, "loop", "I had trouble fetching information from Xtreamly API.")
		logger.error('Error fetching data from API:', {
			message: error.message,
			stack: error.stack,
			...(error.response && { response: error.response.data }),
		});
		throw error;
	}
};

const jobToExecute = async (chatId: string) => {
	try {
		const predictionData = await fetchData(chatId);
		await handleApiResponse(predictionData, chatId);
	} catch (error) {
		await pushMessage(chatId, "loop", "Unfortunately, I was unable to start the loop.")
		console.error('Error in scheduled task:', error);
	}
}

// Function to start the cron job
export const startCronJob = async (chatId: string) => {
	const interval = process.env.EXECUTION_INTERVAL ? parseInt(process.env.EXECUTION_INTERVAL) : 50;
	console.log(interval);

	await jobToExecute(chatId)

	// Schedule the job to run at the specified interval
	const task = cron.schedule(
		`*/${interval} * * * * *`,
		() => jobToExecute(chatId),
		{
			scheduled: true,
			timezone: 'UTC', // Adjust timezone as needed
		}
	);

	logger.info(`Cron job scheduled to run every ${interval} seconds.`);

	return task; // Return the task instance for later control if needed
};

// Function to stop the cron job (useful for graceful shutdown)
export const stopCronJob = (task: cron.ScheduledTask) => {
	if (task) {
		task.stop();
		logger.info('Cron job stopped.');
	}
};
