import express from 'express';
import { createClient } from 'redis';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { connectRabbit, getChannel } from '../../common/src/utils/rabbit.js';
import { successResponse, errorResponse } from '../../common/src/utils/response.js';
import logger from '../../common/src/utils/logger.js';

const app = express();
app.use(express.json());

let redisClient;
const RABBITMQ_URI = process.env.RABBITMQ_URI;
const REDIS_URI = process.env.REDIS_URI;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;

// --- Connect to Redis ---
const connectRedis = async () => {
  redisClient = createClient({ url: REDIS_URI });
  redisClient.on('error', (err) => logger.error('Redis Client Error', err));
  await redisClient.connect();
  logger.info('API Gateway connected to Redis');
};

// --- Idempotency Middleware ---
const checkIdempotency = async (req, res, next) => {
  const { request_id } = req.body;
  if (!request_id) {
    return errorResponse(res, 400, 'request_id is required');
  }
  
  try {
    const result = await redisClient.set(request_id, 'processing', {
      NX: true, // Only set if not exists
      EX: 60,   // Expire in 60 seconds
    });
    
    if (result === null) {
      return errorResponse(res, 409, 'Duplicate request_id: Processing already in progress.');
    }
    next();
  } catch (err) {
    logger.error('Redis error during idempotency check', { error: err.message });
    return errorResponse(res, 500, 'Server error checking idempotency');
  }
};

// --- Health Check ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- Main Notification Endpoint ---
app.post('/api/v1/notifications', checkIdempotency, async (req, res) => {
  // TODO: Add Joi validation for the request body
  const {
    notification_type,
    user_id,
    template_code,
    variables,
    request_id,
  } = req.body;
  
  const correlation_id = uuidv4();
  const log = logger.child({ correlation_id, request_id });

  log.info('Received notification request');
  
  try {
    // 1. Fetch User Data
    const userResponse = await axios.get(`${USER_SERVICE_URL}/api/v1/users/${user_id}`);
    const user = userResponse.data.data;

    if (!user) {
      log.warn('User not found');
      await redisClient.del(request_id); // Unlock idempotency
      return errorResponse(res, 404, 'User not found');
    }

    // 2. Check Preferences
    if (!user.preferences[notification_type]) {
      log.warn(`User ${user_id} has disabled ${notification_type} notifications.`);
      await redisClient.set(request_id, 'completed-prefs-off', { EX: 60 });
      return successResponse(res, 200, 'Notification not sent due to user preferences.');
    }
    
    // 3. Prepare Message
    const message = {
      user,
      template_code,
      variables,
      metadata: {
        correlation_id,
        request_id,
        timestamp: new Date().toISOString(),
      },
    };

    // 4. Publish to Queue
    const channel = getChannel();
    channel.publish(
      'notifications.direct',
      notification_type, // 'email' or 'push'
      Buffer.from(JSON.stringify(message)),
      { 
        persistent: true,
        correlationId: correlation_id,
      }
    );
    
    log.info('Notification queued successfully');
    
    // 5. Respond
    return successResponse(res, 202, 'Notification request accepted and queued.', { 
      notification_id: correlation_id
    });
    
  } catch (err) {
    log.error('Error processing notification request', { error: err.message });
    await redisClient.del(request_id); // Unlock idempotency
    
    if (err.response && err.response.status === 404) {
      return errorResponse(res, 404, 'User or Template not found');
    }
    return errorResponse(res, 500, 'Internal server error');
  }
});

// ... proxy endpoints for /api/v1/users etc. ...

// --- Start Server ---
const PORT = process.env.PORT || 3000;
Promise.all([
  connectRabbit(RABBITMQ_URI),
  connectRedis()
]).then(() => {
  app.listen(PORT, () => {
    logger.info(`API Gateway running on port ${PORT}`);
  });
}).catch(err => {
  logger.error('Failed to start API Gateway', { error: err.message });
  process.exit(1);
});