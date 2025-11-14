import axios from 'axios';
import admin from 'firebase-admin';
import CircuitBreaker from 'opossum';
import { connectRabbit, getChannel } from '../../common/src/utils/rabbit.js';
import logger from '../../common/src/utils/logger.js';
import fs from 'fs';
import path from 'path';

const RABBITMQ_URI = process.env.RABBITMQ_URI;
const TEMPLATE_SERVICE_URL = process.env.TEMPLATE_SERVICE_URL;

// --- Firebase Admin Setup ---
// Make sure you have downloaded your Firebase service account JSON
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH; // path to JSON file
if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
  logger.error('Firebase service account JSON path missing or invalid.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// --- Push Notification Function ---
async function sendPushNotification(pushOptions) {
  try {
    const response = await admin.messaging().send(pushOptions);
    logger.info('Push sent successfully', { response });
    return response;
  } catch (err) {
    logger.error('Firebase send error', { error: err.message });
    throw err;
  }
}

// --- Circuit Breaker Setup ---
const breakerOptions = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};
const pushBreaker = new CircuitBreaker(sendPushNotification, breakerOptions);
pushBreaker.on('open', () => logger.error('Push service circuit BREAKER OPENED.'));
pushBreaker.on('close', () => logger.info('Push service circuit BREAKER CLOSED.'));
pushBreaker.fallback(() => {
  throw new Error('Push service (Firebase) is unavailable');
});

// --- Message Processing ---
const processPushMessage = async (msg) => {
  const channel = getChannel();
  let log;

  try {
    const content = msg.content.toString();
    const message = JSON.parse(content);
    const { user, template_code, variables, metadata } = message;

    log = logger.child({ correlation_id: metadata?.correlation_id });
    log.info('Processing push message');

    if (!user.push_token) {
      log.warn('User has no push_token, skipping');
      channel.ack(msg);
      return;
    }

    // Fetch rendered template
    const renderResponse = await axios.post(
      `${TEMPLATE_SERVICE_URL}/api/v1/templates/render`,
      { template_code, variables }
    );
    const { subject: title, body } = renderResponse.data.data;

    // Prepare push payload
    const pushOptions = {
      token: user.push_token,
      notification: {
        title,
        body,
      },
      // Optional data payload:
      // data: variables,
    };

    await pushBreaker.fire(pushOptions);

    channel.ack(msg);
  } catch (err) {
    if (!log) log = logger;
    log.error('Failed to process push message', { error: err.message });
    channel.nack(msg, false, false); // send to DLQ
  }
};

// --- Start Consumer ---
const startConsumer = async () => {
  await connectRabbit(RABBITMQ_URI);
  const channel = getChannel();

  channel.prefetch(10);
  logger.info('Push Service waiting for messages...');
  channel.consume('push.queue', processPushMessage, { noAck: false });
};

startConsumer().catch((err) => {
  logger.error('Push Service consumer failed to start', { error: err.message });
  process.exit(1);
});
