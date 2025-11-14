import axios from 'axios';
import nodemailer from 'nodemailer';
import CircuitBreaker from 'opossum';
import { connectRabbit, getChannel } from '../../common/src/utils/rabbit.js';
import logger from '../../common/src/utils/logger.js';

const RABBITMQ_URI = process.env.RABBITMQ_URI;
const TEMPLATE_SERVICE_URL = process.env.TEMPLATE_SERVICE_URL;

// --- Email Sending Logic ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(mailOptions) {
  return transporter.sendMail(mailOptions);
}

// --- Circuit Breaker Setup ---
const breakerOptions = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};
const emailBreaker = new CircuitBreaker(sendEmail, breakerOptions);
emailBreaker.on('open', () => logger.error('Email service circuit BREAKER OPENED.'));
emailBreaker.on('close', () => logger.info('Email service circuit BREAKER CLOSED.'));
emailBreaker.fallback(() => {
  throw new Error('Email service is unavailable');
});


// --- Message Processing ---
const processEmailMessage = async (msg) => {
  const channel = getChannel();
  let log;
  
  try {
    const content = msg.content.toString();
    const message = JSON.parse(content);
    const { user, template_code, variables, metadata } = message;
    
    log = logger.child({ correlation_id: metadata.correlation_id });
    log.info('Processing email message');

    // 1. Fetch Rendered Template
    const renderResponse = await axios.post(
      `${TEMPLATE_SERVICE_URL}/api/v1/templates/render`,
      { template_code, variables }
    );
    const { subject, body } = renderResponse.data.data;

    // 2. Send Email via Circuit Breaker
    const mailOptions = {
      from: '"Notification System" <no-reply@example.com>',
      to: user.email,
      subject: subject,
      html: body,
    };
    
    await emailBreaker.fire(mailOptions);
    
    log.info('Email sent successfully');
    
    // 3. Acknowledge message
    channel.ack(msg);
    
  } catch (err) {
    if (!log) { log = logger; } // Ensure log is defined
    log.error('Failed to process email message', { error: err.message });
    
    // 4. Nack (Negative Acknowledge) -> Sends to DLQ
    channel.nack(msg, false, false); 
  }
};

// --- Start Consumer ---
const startConsumer = async () => {
  await connectRabbit(RABBITMQ_URI);
  const channel = getChannel();
  
  channel.prefetch(5); // Process up to 5 messages at a time
  logger.info('Email Service waiting for messages...');
  
  channel.consume('email.queue', processEmailMessage, { noAck: false });
};

startConsumer().catch(err => {
  logger.error('Email Service consumer failed to start', { error: err.message });
  process.exit(1);
});