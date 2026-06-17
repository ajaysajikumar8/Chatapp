self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json();
    
    const promiseChain = clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        let isFocused = false;
        
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.focused) {
            isFocused = true;
            break;
          }
        }

        // Avoid showing notification if the user has the app focused. 
        // Realtime sockets handle new messages in the foreground.
        if (isFocused) {
          return;
        }

        return self.registration.showNotification(data.title, {
          body: data.body,
          icon: '/vite.svg',
          data: data.data,
        });
      });

    event.waitUntil(promiseChain);
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/chat';

  const promiseChain = clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      let matchingClient = null;

      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url.includes('/chat') || windowClient.url.includes(self.location.origin)) {
          matchingClient = windowClient;
          break;
        }
      }

      if (matchingClient) {
        // Send message to client to navigate
        matchingClient.postMessage({ type: 'NAVIGATE', url: urlToOpen });
        return matchingClient.focus();
      } else {
        return clients.openWindow(urlToOpen);
      }
    });

  event.waitUntil(promiseChain);
});
