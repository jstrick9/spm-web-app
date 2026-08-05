/**
 * Generates a VAPID key pair for web push notifications and prints the
 * .env lines to add:
 *
 *   npm run push:keys
 *
 * Copy the output into wedding-app/.env (or your host environment) and
 * restart the server. The keys are long-lived; you only need to run this
 * once per deployment.
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('Add these to your .env file:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:ops@yourdomain.com`);
console.log('');
console.log('Note: keep VAPID_PRIVATE_KEY secret. Rotating keys invalidates');
console.log('all existing subscriptions (users simply re-enable push).');
