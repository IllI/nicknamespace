import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const isDevelopment = process.env.NODE_ENV === 'development';

    const publishableKey = isDevelopment
      ? process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY
      : process.env.NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      console.error(`Missing Stripe publishable key for ${isDevelopment ? 'TEST' : 'LIVE'} mode`);
    }

    stripePromise = loadStripe(publishableKey ?? '');
  }

  return stripePromise;
};
