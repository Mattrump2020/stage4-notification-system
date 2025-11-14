import amqp from 'amqplib';
import logger from './logger.js';

let channel = null;
let connection = null;

const connectRabbit = async (rabbitUri) => {
  try {
    connection = await amqp.connect(rabbitUri);
    channel = await connection.createChannel();
    logger.info('RabbitMQ Connected successfully.');

    // --- Assert Topology (This is Idempotent) ---
    
    // 1. Dead Letter Exchange (DLX)
    await channel.assertExchange('notifications.dlx', 'direct', { durable: true });
    // 2. Failed Queue
    await channel.assertQueue('failed.queue', { durable: true });
    // 3. Bind Failed Queue to DLX
    await channel.bindQueue('failed.queue', 'notifications.dlx', 'failed');

    // 4. Main Exchange
    await channel.assertExchange('notifications.direct', 'direct', { durable: true });
    
    // 5. Main Queues (with DLX configured)
    const queueArgs = {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'notifications.dlx',
        'x-dead-letter-routing-key': 'failed'
      }
    };
    await channel.assertQueue('email.queue', queueArgs);
    await channel.assertQueue('push.queue', queueArgs);

    // 6. Bind Main Queues to Main Exchange
    await channel.bindQueue('email.queue', 'notifications.direct', 'email');
    await channel.bindQueue('push.queue', 'notifications.direct', 'push');
    
    logger.info('RabbitMQ topology asserted.');

  } catch (err) {
    logger.error('RabbitMQ Connection Error:', err);
    process.exit(1);
  }
};

export const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel is not initialized. Call connectRabbit first.');
  }
  return channel;
};

export { connectRabbit, channel, connection };