import Stripe from 'stripe';
import path from 'path';
import dotenv from 'dotenv';

// Explicitly load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development';

// Select appropriate keys based on environment
const stripeSecretKey = isDevelopment
  ? process.env.STRIPE_TEST_SECRET_KEY
  : process.env.STRIPE_LIVE_SECRET_KEY;

const stripeKey = stripeSecretKey || 'sk_test_placeholder';

if (!stripeSecretKey) {
  console.warn(`⚠️  STRIPE_${isDevelopment ? 'TEST' : 'LIVE'}_SECRET_KEY is missing. Stripe features will not work.`);
}

console.log(`🔑 Using Stripe ${isDevelopment ? 'TEST' : 'LIVE'} keys (${process.env.NODE_ENV} mode)`);

export const stripe = new Stripe(stripeKey, {
  // https://github.com/stripe/stripe-node#configuration
  // https://stripe.com/docs/api/versioning
  apiVersion: '2023-10-16',
  // Register this as an official Stripe plugin.
  // https://stripe.com/docs/building-plugins#setappinfo
  appInfo: {
    name: 'Next.js Subscription Starter',
    version: '0.0.0',
    url: 'https://github.com/vercel/nextjs-subscription-payments'
  }
});
