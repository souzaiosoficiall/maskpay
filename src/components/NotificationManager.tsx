import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { getActiveNotifications, dismissNotification } from '@/lib/notifications.functions';
import { NotificationModal } from './NotificationModal';

export function NotificationManager() {
  const [activeNotifications, setActiveNotifications] = useState<any[]>([]);
  const [currentNotification, setCurrentNotification] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const fetchActive = useServerFn(getActiveNotifications);
  const doDismiss = useServerFn(dismissNotification);

  const { data: initialNotifications } = useQuery({
    queryKey: ['active_notifications'],
    queryFn: () => fetchActive({}),
    staleTime: 30000,
  });

  // Load initial notifications
  useEffect(() => {
    if (initialNotifications) {
      setActiveNotifications(initialNotifications);
    }
  }, [initialNotifications]);

  // Handle Realtime
  useEffect(() => {
    const channel = supabase
      .channel('notifications_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          const newNotif = payload.new as any;
          if (newNotif.is_active) {
            setActiveNotifications(prev => {
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
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
          if (!updated.is_active) {
            setActiveNotifications(prev => prev.filter(n => n.id !== updated.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Modal logic: show the first notification in the list
  useEffect(() => {
    if (activeNotifications.length > 0 && !isModalOpen) {
      setCurrentNotification(activeNotifications[0]);
      setIsModalOpen(true);
    }
  }, [activeNotifications, isModalOpen]);

  const handleClose = async (dontShowAgain: boolean) => {
    const closedNotifId = currentNotification?.id;
    
    if (dontShowAgain && closedNotifId) {
      try {
        await doDismiss({ data: { notification_id: closedNotifId } });
      } catch (err) {
        console.error("Erro ao dispensar notificação:", err);
      }
    }
    
    // Always remove from local list for this session to avoid loop
    setActiveNotifications(prev => prev.filter(n => n.id !== closedNotifId));
    setIsModalOpen(false);
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
