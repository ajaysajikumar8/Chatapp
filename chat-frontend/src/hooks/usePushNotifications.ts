import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const usePushNotifications = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported in this browser.');
      return;
    }

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        console.warn('Push notification permission denied.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
          console.error("VAPID public key is not set in environment variables.");
          return;
      }
      
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      await api.post('/push/subscribe', subscription);
      setIsSubscribed(true);
      setPushError(null);
      console.log('Successfully subscribed to push notifications');
    } catch (error: any) {
      console.error('Failed to subscribe to push notifications:', error);
      
      // Specifically detect Brave's push service error or generic DOMExceptions
      if (error?.message?.includes('push service error') || error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
          setPushError("Push notifications failed to register. If using Brave, go to Settings -> Privacy and security, and enable 'Use Google services for push messaging'.");
      } else {
          setPushError("An unknown error occurred while setting up push notifications.");
      }
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
            await subscription.unsubscribe();
            setIsSubscribed(false);
            console.log('Successfully unsubscribed from push notifications');
        }
    } catch (error) {
        console.error('Failed to unsubscribe:', error);
    }
  }, []);

  useEffect(() => {
    // Check initial subscription state
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          setIsSubscribed(!!subscription);
        });
      });
    }
  }, []);

  return { isSubscribed, permission, pushError, setPushError, subscribe, unsubscribe };
};
