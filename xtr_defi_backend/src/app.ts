import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { metricsMiddleware, setupMetrics } from './utils/metrics';
import logger from './utils/logger';
import { createChat, pushMessage } from './utils/ui_pusher';
import listEndpoints from 'express-list-endpoints';
import transactionRoutes from './routes/transactionRoutes';
import { errorHandler } from './middleware/errorHandler';
import cors from 'cors';
import { startCronJob, stopCronJob } from './cron/job';

const app = express();
const jobs: any = {}

// Setup Helmet for security
app.use(cors());
app.use(helmet());
app.use(express.json());

// Setup Rate Limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // limit each IP to 100 requests per windowMs
	message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Setup Morgan to use Winston's stream
app.use(
	morgan('combined', {
		stream: {
			write: (message: string) => logger.info(message.trim()),
		},
	})
);

// Setup Metrics Middleware
app.use(metricsMiddleware);

app.use('/api', transactionRoutes);

app.get('/health', (_req, res) => {
	res.json({ status: 'OK' });
});

app.get('/routes', (_req, res) => {
	const routes = listEndpoints(app);
	res.json(routes);
});

app.get('/test-log', (_req, res) => {
	logger.info('Test log endpoint accessed');
	res.json({ message: 'Check your logs!' });
});

app.get('/init_chat', async (_req, res) => {
	const chatId = await createChat();
	res.json({ chatId });
});

app.get('/init_agent', async (_req, res) => {
	res.json({});
});

async function startLoop(chatId: string) {
	jobs[chatId] = await startCronJob(chatId)
	await pushMessage(chatId, "loop", "I have initiated the loop trading process...")
}

async function stopLoop(chatId: string) {
	stopCronJob(jobs[chatId])
	await pushMessage(chatId, "loop", "I have terminated the loop trading process.")
	await pushMessage(chatId, "loop", "I hope I'll see you back soon!")
}

app.get('/stop_chat', async (req, res) => {
	const { chatId } = req.query;
	await stopLoop(chatId as string);
	res.json({ message: "ok" });
});

app.post('/conversation', async (req, res) => {
	const { chatId, msg } = req.body;
	await pushMessage(chatId, "human_proxy", msg)

	if (msg.toLowerCase().includes("start")) {
		await startLoop(chatId);
	} else if (msg.toLowerCase().includes("stop")) {
		await stopLoop(chatId);
	}
	res.json({ msg: "xtreamly agent triggered" });
})

// Setup Metrics Endpoint
setupMetrics(app);

app.use(errorHandler);

export default app;
