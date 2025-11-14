⚠️ Push Service Dependencies Notice

The current implementation of the push-service uses fcm-node for Firebase Cloud Messaging.

Important notes:

fcm-node depends on several deprecated packages (google-p12-pem, boolean, hoek, topo, mkdirp, etc.).

Some of these dependencies have known security vulnerabilities (moderate, high, or critical).

These warnings do not affect functionality in development and testing.

For production use, it is strongly recommended to replace fcm-node with firebase-admin, which is actively maintained and more secure.

This ensures long-term support, fewer vulnerabilities, and compatibility with newer Node.js versions.

Reference:

firebase-admin documentation