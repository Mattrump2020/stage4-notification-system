import express from 'express';
import Mustache from 'mustache';
import { connectDB } from '../../common/src/utils/db.js';
import logger from '../../common/src/utils/logger.js';
import { successResponse, errorResponse } from '../../common/src/utils/response.js';
import Template from './models/template.model.js';

const app = express();
app.use(express.json());

// --- Health Check ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- API Endpoints ---
app.post('/api/v1/templates', async (req, res) => {
  try {
    const { template_code, subject, body } = req.body;
    // Add logic to increment version if template_code exists
    const newTemplate = await Template.create({ template_code, subject, body });
    return successResponse(res, 201, 'Template created', newTemplate);
  } catch (err) {
    logger.error('Template creation failed', { error: err.message });
    return errorResponse(res, 500, 'Server error');
  }
});

app.get('/api/v1/templates/:code', async (req, res) => {
  try {
    const template = await Template.findOne({ template_code: req.params.code })
                                   .sort({ version: -1 }); // Get latest
    if (!template) {
      return errorResponse(res, 404, 'Template not found');
    }
    return successResponse(res, 200, 'Template retrieved', template);
  } catch (err) {
    logger.error('Template retrieval failed', { error: err.message });
    return errorResponse(res, 500, 'Server error');
  }
});

// Endpoint to render a template
app.post('/api/v1/templates/render', async (req, res) => {
  try {
    const { template_code, variables } = req.body;
    const template = await Template.findOne({ template_code }).sort({ version: -1 });
    
    if (!template) {
      return errorResponse(res, 404, 'Template not found');
    }
    
    // Use Mustache to render
    const renderedBody = Mustache.render(template.body, variables);
    const renderedSubject = Mustache.render(template.subject, variables);
    
    return successResponse(res, 200, 'Template rendered', {
      subject: renderedSubject,
      body: renderedBody,
    });
  } catch (err) {
    logger.error('Template rendering failed', { error: err.message });
    return errorResponse(res, 500, 'Server error');
  }
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

connectDB(MONGO_URI).then(() => {
  app.listen(PORT, () => {
    logger.info(`Template Service running on port ${PORT}`);
  });
});