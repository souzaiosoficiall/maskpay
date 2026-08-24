import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { getActiveNotifications, dismissNotification } from '@/lib/notifications.functions';
import { NotificationModal } from './NotificationModal';

export function NotificationManager() {
  const [activeNotifications, setActiveNotifications] = useState<any[]>([]);
  const [currentNotification, setCurrentNotification] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const shownIdsRef = useRef<Set<string>>(new Set());
  
  const queryClient = useQueryClient();
  const fetchActive = useServerFn(getActiveNotifications);
  const doDismiss = useServerFn(dismissNotification);

  const { data: initialNotifications, refetch } = useQuery({
    queryKey: ['active_notifications'],
    queryFn: () => fetchActive({}),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000, // safety net polling every 60s
  });

  // Load initial notifications
  useEffect(() => {
    if (initialNotifications) {
      setActiveNotifications(initialNotifications);
    }
  }, [initialNotifications]);

  const pushNotification = useCallback((newNotif: any) => {
    if (!newNotif?.id || !newNotif.is_active) return;
    if (shownIdsRef.current.has(newNotif.id)) return;

    setActiveNotifications((prev) => {
      if (prev.some((n) => n.id === newNotif.id)) return prev;
      return [newNotif, ...prev];
    });
  }, []);

  // Supabase Realtime — INSERT / UPDATE on notifications table
  useEffect(() => {
    const channel = supabase
      .channel('notifications_realtime_v2')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif?.is_active) {
            pushNotification(newNotif);
            queryClient.invalidateQueries({ queryKey: ['active_notifications'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const updated = payload.new as any;
          if (!updated?.is_active) {
            setActiveNotifications((prev) => prev.filter((n) => n.id !== updated.id));
          } else {
            pushNotification(updated);
          }
          queryClient.invalidateQueries({ queryKey: ['active_notifications'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          refetch().catch(() => undefined);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pushNotification, queryClient, refetch]);

  // When a push arrives while the app is open, the SW posts a message
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'MASKPAY_FOREGROUND_NOTIFICATION' || data.type === 'PUSH_NOTIFICATION') {
        const notif = {
          id: data.id || `push-${Date.now()}`,
          title: data.title || 'MaskPay',
          description: data.body || data.description || '',
          is_active: true,
        };
        pushNotification(notif);
        queryClient.invalidateQueries({ queryKey: ['active_notifications'] });
      }

      if (data.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        refetch().catch(() => undefined);
      }
    };

    navigator.serviceWorker?.addEventListener?.('message', onMessage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('maskpay-notifications');
      bc.onmessage = (ev) => onMessage(ev as MessageEvent);
    } catch {
      // BroadcastChannel may be unavailable
    }

    return () => {
      navigator.serviceWorker?.removeEventListener?.('message', onMessage);
      try {
        bc?.close();
      } catch {
        // ignore
      }
    };
  }, [pushNotification, queryClient, refetch]);

  // Refetch when app comes back to foreground
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refetch().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetch]);

  // Modal logic: show the first notification in the list
  useEffect(() => {
    if (activeNotifications.length > 0 && !isModalOpen) {
      const next = activeNotifications[0];
      setCurrentNotification(next);
      setIsModalOpen(true);
      if (next?.id) shownIdsRef.current.add(next.id);
    }
  }, [activeNotifications, isModalOpen]);

  const handleClose = async (dontShowAgain: boolean) => {
    const closedNotifId = currentNotification?.id;
    
    if (dontShowAgain && closedNotifId && !String(closedNotifId).startsWith('push-')) {
      try {
        await doDismiss({ data: { notification_id: closedNotifId } });
      } catch (err) {
        console.error("Erro ao dispensar notificação:", err);
      }
    }
    
    setActiveNotifications((prev) => prev.filter((n) => n.id !== closedNotifId));
    setIsModalOpen(false);
    setCurrentNotification(null);
  };

  if (!currentNotification) return null;

  return (
    <NotificationModal
      isOpen={isModalOpen}
      onClose={handleClose}
      title={currentNotification.title}
      description={currentNotification.description}
    />
  );
}
