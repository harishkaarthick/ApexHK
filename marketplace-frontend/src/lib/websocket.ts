import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import toast from 'react-hot-toast';
import { useNotificationStore } from '@/stores';
import { queryClient } from '@/lib/queryClient';

let stompClient: Client | null = null;

function getWebSocketUrl() {
  const configuredUrl = import.meta.env.VITE_WS_URL as string;

  if (window.location.protocol !== 'https:') {
    return configuredUrl;
  }

  return configuredUrl
    .replace(/^http:/, 'https:')
    .replace(/^ws:/, 'wss:');
}

export function connectWebSocket(accessToken: string) {
  if (stompClient?.active) return;

  stompClient = new Client({
    webSocketFactory: () =>
      new SockJS(getWebSocketUrl()),
    connectHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
    reconnectDelay: 5000,
    onConnect: () => {
      stompClient!.subscribe('/user/queue/notifications', (message) => {
        try {
          const notification = JSON.parse(message.body) as {
            title: string;
            message: string;
            type?: string;
            referenceId?: string;
          };

          // Increment bell badge for every notification
          useNotificationStore.getState().increment();

          toast(notification.title + ': ' + notification.message, {
            icon: '🔔',
          });

          // ── FIX: react to order-related notification types ───────────────
          // The backend sends type:"NEW_ORDER" to the vendor as soon as a
          // customer successfully places an order.  Previously this was
          // ignored, so the vendor orders page stayed stale until a manual
          // refresh.  Now we invalidate the vendor queries immediately so
          // the new order appears without any user action.
          if (notification.type === 'NEW_ORDER') {
            queryClient.invalidateQueries({ queryKey: ['vendor-orders'] });
            queryClient.invalidateQueries({ queryKey: ['vendor-orders-stats'] });
          }

          // Also refresh on status changes so the vendor's own updates
          // (confirmed / shipped etc.) reflect in real-time across tabs.
          if (
            notification.type === 'ORDER_STATUS' ||
            notification.type === 'ORDER_CONFIRMED' ||
            notification.type === 'ORDER_SHIPPED' ||
            notification.type === 'ORDER_DELIVERED' ||
            notification.type === 'ORDER_OUT_FOR_DELIVERY'
          ) {
            queryClient.invalidateQueries({ queryKey: ['vendor-orders'] });
            queryClient.invalidateQueries({ queryKey: ['vendor-orders-stats'] });
            // Customer-side order detail too
            if (notification.referenceId) {
              queryClient.invalidateQueries({ queryKey: ['order', notification.referenceId] });
            }
          }
          // ────────────────────────────────────────────────────────────────

        } catch {
          // malformed message — ignore
        }
      });
    },
    onDisconnect: () => {
      console.log('[WS] disconnected');
    },
    onStompError: (frame) => {
      console.error('[WS] STOMP error', frame);
    },
  });

  stompClient.activate();
}

export function disconnectWebSocket() {
  if (stompClient?.active) {
    stompClient.deactivate();
    stompClient = null;
  }
}

export function getStompClient() {
  return stompClient;
}
