import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OrderItem {
  id: string;
  name: string;
  price: string;
  quantity: number;
}

interface Order {
  id: string;
  createdAt: string;
  total: string;
  items: OrderItem[];
}

const { width } = Dimensions.get('window');
const PLACEHOLDER_AVATAR = require('../assets/images/avatar.jpg');

// Reusing fetchWithRetry from Checkout component
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retries: number = 4,
  initialDelay: number = 300
): Promise<Response> => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  ];

  for (let i = 0; i < retries; i++) {
    const currentUserAgent = userAgents[i % userAgents.length];
    const defaultHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': currentUserAgent,
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      ...options.headers,
    };

    const sessionCookie = await AsyncStorage.getItem('sessionCookie');
    if (sessionCookie && i >= 2) {
      defaultHeaders['Cookie'] = sessionCookie;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: defaultHeaders,
        credentials: 'include',
      });
      if (!response.ok) {
        const errorText = await response.text();
        const responseHeaders = Object.fromEntries(response.headers.entries());
        console.log(
          `Fetch attempt ${i + 1} of ${retries} failed for ${url}: [Error: HTTP ${response.status}] - ${errorText}`,
          {
            headers: responseHeaders,
            payload: options.body ? JSON.parse(options.body as string) : null,
          }
        );
        if (response.status === 403 && i < retries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          console.log(`Waiting ${delay}ms before retrying with User-Agent: ${currentUserAgent}...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`HTTP ${response.status} - ${errorText}`);
      }
      console.log(`Fetch succeeded for ${url} on attempt ${i + 1}`);
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        await AsyncStorage.setItem('sessionCookie', setCookie);
      }
      return response;
    } catch (error) {
      console.log(`Fetch attempt ${i + 1} of ${retries} failed for ${url}:`, error);
      if (i < retries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Waiting ${delay}ms before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Fetch failed after ${retries} attempts`);
};

export default function DeliveredOrders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [name, setName] = useState<string>('User');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showLoginPromptModal, setShowLoginPromptModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchDeliveredOrders = async () => {
      setIsLoading(true);
      try {
        const id = await AsyncStorage.getItem('id');
        if (!id) {
          setShowLoginPromptModal(true);
          setIsLoading(false);
          return;
        }

        // Fetch user data
        try {
          const userResponse = await fetchWithRetry(`https://cravii.ng/cravii/api/get_user.php?id=${id}`, {
            method: 'GET',
            credentials: 'include',
          });
          const userResult = await userResponse.json();
          if (userResult.success) {
            setName(userResult.data.name || 'User');
          } else {
            console.error('User fetch failed:', userResult?.message || 'Unknown error');
          }
        } catch (userError) {
          console.error('User fetch failed:', userError);
        }

        // Fetch delivered orders
        try {
          const ordersResponse = await fetchWithRetry(
            `https://cravii.ng/cravii/api/get_user_orders.php?user_id=${id}&status=delivered`,
            {
              method: 'GET',
              credentials: 'include',
            }
          );
          const ordersResult = await ordersResponse.json();
          if (ordersResult.success) {
            setOrders(ordersResult.data || []);
          } else {
            setErrorMessage('Failed to fetch orders. Please try again.');
            console.error('Orders fetch failed:', ordersResult?.message || 'Unknown error');
          }
        } catch (ordersError) {
          setErrorMessage('Failed to fetch orders. Please check your connection and try again.');
          console.error('Orders fetch failed:', ordersError);
        }
      } catch (error) {
        setErrorMessage('An unexpected error occurred. Please try again.');
        console.error('Fetch delivered orders error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeliveredOrders();
  }, []);

  useEffect(() => {
    if (showLoginPromptModal) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [showLoginPromptModal]);

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarPlaceholder, { backgroundColor: '#f8f8f8', height: insets.top }]} />
      <ScrollView
        style={styles.scrollViewContent}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.userInfo}>
            <Image source={PLACEHOLDER_AVATAR} style={styles.avatar} />
            <View>
              <Text style={styles.greeting}>Hello {name}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/profile')}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Delivered Orders</Text>
        </View>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff5722" />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No delivered orders found.</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>Order #{order.id}</Text>
                <Text style={styles.orderDate}>
                  {new Date(order.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              {order.items.map((item) => (
                <View key={item.id} style={styles.orderItem}>
                  <Text style={styles.itemName}>
                    {item.name} (x{item.quantity})
                  </Text>
                  <Text style={styles.itemPrice}>
                    ₦{(parseFloat(item.price.replace('₦', '') || '0') * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
              <View style={styles.orderTotal}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>₦{order.total}</Text>
              </View>
            </View>
          ))
        )}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>
      <Modal
        animationType="fade"
        transparent={true}
        visible={showLoginPromptModal}
        onRequestClose={() => {
          setShowLoginPromptModal(false);
          AsyncStorage.removeItem('id').then(() => router.replace('/login'));
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
            <Feather name="lock" size={50} color="#ff5722" style={styles.modalIcon} />
            <Text style={styles.modalTitle}>Please Login to View Orders</Text>
            <Text style={styles.modalMessage}>
              Please login to view your delivered orders.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowLoginPromptModal(false);
                AsyncStorage.removeItem('id').then(() => router.replace('/login'));
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/')}>
          <Feather name="home" size={24} color="#999" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/search')}>
          <Feather name="search" size={24} color="#999" />
          <Text style={styles.navText}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/cart')}>
          <Feather name="shopping-cart" size={24} color="#999" />
          <Text style={styles.navText}>My Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
          <Feather name="user" size={24} color="#ff5722" />
          <Text style={styles.navTextActive}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  statusBarPlaceholder: { backgroundColor: '#f8f8f8' },
  scrollViewContent: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#ff5722',
  },
  greeting: { fontSize: 16, color: '#666', fontWeight: '500' },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 15,
    marginTop: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderId: { fontSize: 16, fontWeight: '600', color: '#333' },
  orderDate: { fontSize: 14, color: '#666' },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  itemName: { fontSize: 16, color: '#333', fontWeight: '500' },
  itemPrice: { fontSize: 16, color: '#4ade80', fontWeight: '500' },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 10,
  },
  totalLabel: { fontSize: 18, fontWeight: '700', color: '#333' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#e63946' },
  errorText: {
    color: '#e63946',
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.85,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#ff5722',
  },
  modalIcon: { marginBottom: 20 },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: '#ff5722',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '45%',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  navItem: { alignItems: 'center', paddingVertical: 5 },
  navText: { fontSize: 12, color: '#999', marginTop: 4, fontWeight: '600' },
  navTextActive: { fontSize: 12, color: '#ff5722', marginTop: 4, fontWeight: '700' },
}); 