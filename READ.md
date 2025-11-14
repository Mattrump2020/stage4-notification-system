🚀 Distributed Notification System
This is a scalable, fault-tolerant, microservice-based system for sending email and push notifications. It is designed to be decoupled from a main application, handling all notification logic asynchronously via a message queue. This ensures that your main application remains fast and responsive, even when sending thousands of notifications.

🏛️ System Architecture
This project follows a microservice architecture. All services are containerized with Docker and orchestrated with Docker Compose.

Application Services
📦 API Gateway (api-gateway): The single entry point for all incoming requests. It validates, authenticates, and routes notification requests to the correct message queue.

👤 User Service (user-service): Manages user data, login/auth, and notification preferences (e.g., "enable email," "enable push").

📄 Template Service (template-service): Manages notification templates (for email and push) using Mustache for variable substitution.

✉️ Email Service (email-service): A worker service that consumes from the email.queue, renders the appropriate template, and sends emails via SMTP (e.g., Mailtrap, SendGrid).

📱 Push Service (push-service): A worker service that consumes from the push.queue, renders the appropriate template, and sends push notifications via Firebase Admin SDK.

Infrastructure Services
🐇 RabbitMQ: The message broker that decouples the services.

🍃 MongoDB: The primary database, used by User Service and Template Service.

⚡ Redis: Used for caching and ensuring idempotency (preventing duplicate requests).

🛠️ Tech Stack
Backend: Node.js, Express.js

Database: MongoDB (with Mongoose)

Message Queue: RabbitMQ (with amqplib)

Cache: Redis

Containerization: Docker & Docker Compose

Push Notifications: Firebase Admin SDK

Email: Nodemailer

Circuit Breaker: opossum

Templating: mustache

CI/CD: GitHub Actions

✨ Key Features
Microservice Architecture: Each service is independent, scalable, and maintainable.

Asynchronous Processing: The API Gateway responds in <100ms by publishing jobs to RabbitMQ, not waiting for them to complete.

Fault Tolerance: Uses Circuit Breakers (opossum) to prevent cascading failures when an external service (like SMTP or FCM) is down.

Failure Handling: Failed messages are automatically routed to a Dead-Letter Queue (DLQ) for inspection and reprocessing.

Idempotency: Prevents duplicate notifications from being sent by checking a unique request_id in Redis.

Horizontal Scaling: You can run multiple instances of the email-service or push-service workers to handle high loads.

Centralized Tracing: Uses Correlation IDs to trace a single request's lifecycle across all microservices in the logs.

🚀 Getting Started
Follow these steps to get the entire system running on your local machine.

1. Prerequisites
Before you begin, ensure you have the following installed:

Docker

Node.js (for package management, though Docker is primary)

You will also need:

A Firebase Service Account:

Go to your Firebase project settings > "Service Accounts".

Click "Generate new private key".

Rename the downloaded file to serviceAccountKey.json and place it in the root of this project folder.

A Mailtrap (or other SMTP) Account:

Sign up for a free Mailtrap account.

Go to your "Inboxes" and find your SMTP credentials.

2. Clone the Repository
Bash

git clone <your-repository-url>
cd distributed-notification-system
3. Create Environment Variables
Create a new file named .env in the root of the project. Copy and paste the contents of .env.example (below) into it and fill in your secrets.

.env.example
Ini, TOML

# --- .env.example ---
# Copy this to a new file named .env

# User Service
# A strong, random string for signing login tokens
JWT_SECRET=your_super_strong_jwt_secret_12345

# Email Service
# Get these from your Mailtrap.io inbox
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
4. Update docker-compose.yml
Your docker-compose.yml file needs to be able to read your new .env file. Add the env_file: ./.env line to any service that needs a secret (like user-service and email-service).

Example for user-service:

YAML

  user-service:
    build:
      context: ./packages/user-service
    container_name: user-service
    env_file: ./.env # <-- ADD THIS LINE
    ports:
      - "3001:3000"
    environment:
      PORT: 3000
      MONGO_URI: mongodb://mongo:27017/user_db
      # The JWT_SECRET will be read from your .env file
      NODE_ENV: development
    # ...
Example for email-service:

YAML

  email-service:
    build:
      context: ./packages/email-service
    container_name: email-service
    env_file: ./.env # <-- ADD THIS LINE
    environment:
      RABBITMQ_URI: amqp://user:password@rabbitmq:5672
      TEMPLATE_SERVICE_URL: http://template-service:3000
      # SMTP variables will be read from your .env file
      NODE_ENV: development
    # ...
5. Build and Run the System
This single command will build all 5 service images, start all 8 containers, and connect them to the network.

Bash

docker-compose up --build
You're all set! The system is now running.

API Gateway is available at http://localhost:3000

RabbitMQ UI is available at http://localhost:15672 (user: user, pass: password)

📖 API Endpoints
Here are the primary endpoints for using the system.

User Service
POST /api/v1/users - Create a new user.

GET /api/v1/users/:id - Get user details (used by the gateway).

Template Service
POST /api/v1/templates - Create a new notification template.

POST /api/v1/templates/render - Render a template (used by workers).

API Gateway (Main Entry)
POST /api/v1/notifications - Send a new notification.

Request Body:

JSON

{
  "notification_type": "email",
  "user_id": "60d...a5c",
  "template_code": "welcome-email",
  "variables": {
    "name": "John Doe",
    "link": "https://example.com"
  },
  "request_id": "unique-id-from-client-12345"
}
📁 Project Structure
distributed-notification-system/
├── .env                 # Your local secrets
├── .env.example         # Template for secrets
├── .github/             # CI/CD workflows
│   └── workflows/
│       └── ci-cd.yml
├── docker-compose.yml   # Orchestrates all services
├── serviceAccountKey.json # Your Firebase key (in .gitignore)
└── packages/
    ├── api-gateway/     # Entry point service
    ├── common/          # Shared code (utils, middleware)
    ├── email-service/   # Email worker
    ├── push-service/    # Push worker
    ├── template-service/ # Template management service
    └── user-service/    # User management service
Continuous Integration (CI/CD)
This project includes a GitHub Actions workflow in .github/workflows/ci-cd.yml. On every push to the main branch, this workflow will:

Log in to Docker Hub (using your DOCKER_USERNAME and DOCKER_PASSWORD secrets).

Build a new Docker image for each of the 5 microservices.

Push all 5 images to your Docker Hub registry, tagging them as :latest.