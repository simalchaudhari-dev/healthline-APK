import { Platform } from 'react-native';
import { colors } from '../config/colors';
import { apiConfirmRazorpayPayment } from '../services/subscriptionService';
import { toast } from './toast';

const openedCheckouts = new Set();

function recurringMethods() {
  return {
    display: {
      blocks: {
        upi: {
          name: 'UPI AutoPay',
          instruments: [{ method: 'upi' }],
        },
        cards: {
          name: 'Debit and credit cards',
          instruments: [{ method: 'card' }],
        },
        emandate: {
          name: 'Netbanking e-mandate',
          instruments: [{ method: 'emandate' }],
        },
      },
      sequence: ['block.upi', 'block.cards', 'block.emandate'],
      preferences: { show_default_blocks: true },
    },
  };
}

function oneTimeMethods() {
  return {
    display: {
      blocks: {
        upi: {
          name: 'UPI',
          instruments: [
            { method: 'upi', flows: ['qr'] },
            { method: 'upi', flows: ['collect'] },
            { method: 'upi', flows: ['intent'], apps: ['google_pay', 'phonepe'] },
          ],
        },
      },
      sequence: ['block.upi', 'upi', 'card', 'netbanking', 'wallet'],
      preferences: { show_default_blocks: true },
    },
  };
}

function suppressBlankPopups() {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return () => {};
  const original = window.open.bind(window);
  window.open = (url, ...rest) => {
    const target = String(url || '');
    if (!target || target === 'about:blank' || target.startsWith('about:')) {
      return {
        closed: false,
        close() {
          this.closed = true;
        },
        focus() {},
        blur() {},
        postMessage() {},
        location: { href: 'about:blank', replace() {}, assign() {} },
        document: { open() {}, write() {}, close() {}, body: { appendChild() {} } },
      };
    }
    return original(url, ...rest);
  };
  return () => {
    window.open = original;
  };
}

function loadRazorpayJs() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Payment opens in the web preview.'));
  }
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-healthline-razorpay]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.healthlineRazorpay = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay.'));
    document.head.appendChild(script);
  });
}

/** Opens Razorpay on the current screen. No extra Pay page. */
export async function openRazorpayCheckout(order, { accessToken, onPaid } = {}) {
  if (Platform.OS !== 'web') {
    throw new Error('Open the web preview to pay with Razorpay.');
  }
  const checkoutId = order?.mode === 'subscription' ? order.subscriptionId : order?.orderId;
  if (!checkoutId || !order?.keyId) {
    throw new Error('Unable to start Razorpay checkout.');
  }
  if (openedCheckouts.has(checkoutId)) return;
  openedCheckouts.add(checkoutId);
  await loadRazorpayJs();
  if (!window.Razorpay) {
    openedCheckouts.delete(checkoutId);
    throw new Error('Unable to load Razorpay.');
  }

  const restoreOpen = suppressBlankPopups();
  const recurring = order.mode === 'subscription';
  const release = () => {
    openedCheckouts.delete(checkoutId);
    restoreOpen();
  };

  const checkout = new window.Razorpay({
    key: order.keyId,
    ...(recurring
      ? { subscription_id: order.subscriptionId }
      : {
          amount: order.amount,
          currency: order.currency || 'INR',
          order_id: order.orderId,
        }),
    name: order.name || 'HealthLine',
    description: order.description || 'HealthLine payment',
    prefill: order.prefill || {},
    theme: { color: colors.primary || '#2e7d32' },
    redirect: false,
    config: recurring ? recurringMethods() : oneTimeMethods(),
    handler: async (response) => {
      release();
      try {
        const data = await apiConfirmRazorpayPayment(accessToken, {
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
          subscriptionId: recurring ? order.subscriptionId : '',
        });
        if (data?.user) await onPaid?.(data.user);
        toast.success('Payment saved');
      } catch (err) {
        toast.error(err.message || 'Unable to save the payment.');
      }
    },
    modal: {
      ondismiss: release,
    },
  });
  checkout.on('payment.failed', (response) => {
    release();
    toast.error(response?.error?.description || 'Payment was not completed.');
  });
  checkout.open();
}
