import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export default function Notification() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch notifications and count on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const userId = await AsyncStorage.getItem('id');
        if (!userId) {
          console.warn('No user ID found.');
          setNotifications([]);
          setNotificationCount(0);
          await AsyncStorage.setItem('notificationCount', '0');
          return;
        }

        const response = await fetch(`https://cravii.ng/cravii/api/get_notifications.php?user_id=${userId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const result: ApiResponse<Notification[]> = await response.json();
        if (result.success) {
          console.log('Fetched Notifications:', result.data);
          setNotifications(result.data || []);
          const unreadCount = result.data.filter((notification) => !notification.is_read).length;
          setNotificationCount(unreadCount);
          await AsyncStorage.setItem('notificationCount', unreadCount.toString());
        } else {
          console.error('Failed to fetch notifications:', result.message);
          setNotifications([]);
          setNotificationCount(0);
          await AsyncStorage.setItem('notificationCount', '0');
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setNotifications([]);
        setNotificationCount(0);
        await AsyncStorage.setItem('notificationCount', '0');
      }
    };
    fetchNotifications();
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`https://cravii.ng/cravii/api/mark_notification_read.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notificationId }),
      });
      const result = await response.json();
      if (result.success) {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId ? { ...notification, is_read: true } : notification
          )
        );
        const unreadCount = notifications.filter((notification) => !notification.is_read && notification.id !== notificationId).length;
        setNotificationCount(unreadCount);
        await AsyncStorage.setItem('notificationCount', unreadCount.toString());
        console.log('Marked notification as read:', notificationId);
      } else {
        console.error('Failed to mark notification as read:', result.message);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarPlaceholder, { height: insets.top, backgroundColor: '#ffffff' }]} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/')}
          accessibilityRole="button"
          accessibilityLabel="Go back to dashboard"
        >
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      <ScrollView
        style={styles.scrollViewContent}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.notificationList}>
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationItem, notification.is_read ? styles.readNotification : styles.unreadNotification]}
                onPress={() => !notification.is_read && markAsRead(notification.id)}
                accessibilityRole="button"
                accessibilityLabel={`Mark notification ${notification.title} as read`}
              >
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationText}>{notification.message}</Text>
                <Text style={styles.notificationDate}>
                  {new Date(notification.created_at).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noNotificationsText}>No notifications available</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  statusBarPlaceholder: {
    backgroundColor: '#ffffff',
  },
  scrollViewContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginLeft: 10,
  },
  notificationList: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  notificationItem: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadNotification: {
    backgroundColor: '#f0f0f0',
  },
  readNotification: {
    backgroundColor: '#ffffff',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 5,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#333',
  },
  notificationDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  noNotificationsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
});