import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const PLACEHOLDER_AVATAR = require('../assets/images/avatar.jpg');

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
        throw new Error(`HTTP ${response.status} - ${errorText}`);
      }
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        await AsyncStorage.setItem('sessionCookie', setCookie);
      }
      return response;
    } catch (error) {
      console.log(`Fetch attempt ${i + 1} failed for ${url}:`, error);
      if (i < retries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Fetch failed after ${retries} attempts`);
};

interface Restaurant {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
}

export default function CustomOrders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [selectedOption, setSelectedOption] = useState('all');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState('success');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const id = await AsyncStorage.getItem('id');
        console.log('AsyncStorage id:', id);
        if (!id) {
          setModalMessage('Please log in to submit a custom order.');
          setModalType('error');
          setModalVisible(true);
          setIsLoading(false);
          return;
        }

        // Fetch user data
        const userResponse = await fetchWithRetry(`https://cravii.ng/cravii/api/get_user.php?id=${id}`, {
          method: 'GET',
        });
        const userResult = await userResponse.json();
        console.log('get_user.php response:', userResult);
        if (userResult.success) {
          setUser({ id, name: userResult.data.name || 'User' });
        } else {
          setModalMessage(userResult.message || 'Failed to load user data. Please try again.');
          setModalType('error');
          setModalVisible(true);
          setIsLoading(false);
          return;
        }

        // Fetch restaurant IDs from restaurant_custom_orders
        const idsResponse = await fetchWithRetry('https://cravii.ng/cravii/api/get_restaurant_ids.php', {
          method: 'GET',
        });
        const idsResult = await idsResponse.json();
        console.log('get_restaurant_ids.php response:', idsResult);
        if (idsResult.success) {
          const restaurantIds = idsResult.data || [];

          // Fetch details for each restaurant ID using get_restaurant.php
          const restaurantPromises = restaurantIds.map(async (restaurantId: string) => {
            try {
              const response = await fetchWithRetry(`https://cravii.ng/cravii/api/get_restaurant.php?id=${restaurantId}`, {
                method: 'GET',
              });
              const result = await response.json();
              if (result.success) {
                return { id: restaurantId, name: result.data.name };
              }
              return null;
            } catch (error) {
              console.log(`Failed to fetch restaurant ${restaurantId}:`, error);
              return null;
            }
          });

          const restaurantResults = await Promise.all(restaurantPromises);
          const validRestaurants = restaurantResults.filter((r): r is Restaurant => r !== null);
          setRestaurants(validRestaurants);

          if (validRestaurants.length === 0) {
            setModalMessage('No restaurants are currently accepting custom orders.');
            setModalType('error');
            setModalVisible(true);
          }
        } else {
          setModalMessage(idsResult.message || 'Failed to load restaurant IDs.');
          setModalType('error');
          setModalVisible(true);
        }
      } catch (error: any) {
        console.log('Fetch error:', error);
        setModalMessage(error.message || 'An error occurred. Please check your connection.');
        setModalType('error');
        setModalVisible(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      setModalMessage('Please enter a description for your custom order.');
      setModalType('error');
      setModalVisible(true);
      return;
    }

    const id = await AsyncStorage.getItem('id');
    if (!id) {
      setModalMessage('Please log in to submit a custom order.');
      setModalType('error');
      setModalVisible(true);
      return;
    }

    const requestData = {
      user_id: id,
      description,
      selected_restaurants: selectedOption === 'all' ? null : [selectedOption],
    };

    try {
      console.log('Submitting custom order:', requestData);
      const response = await fetchWithRetry('https://cravii.ng/cravii/api/submit_custom_request.php', {
        method: 'POST',
        body: JSON.stringify(requestData),
      });
      const result = await response.json();
      console.log('submit_custom_request.php response:', result);
      if (result.success) {
        setModalMessage('Custom order submitted successfully!');
        setModalType('success');
        setDescription('');
        setSelectedOption('all');
      } else {
        setModalMessage(result.message || 'Failed to submit custom order.');
        setModalType('error');
      }
    } catch (error: any) {
      console.log('Submit error:', error);
      setModalMessage(error.message || 'An error occurred. Please try again.');
      setModalType('error');
    } finally {
      setModalVisible(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarPlaceholder, { height: insets.top }]} />
      <ScrollView
        style={styles.scrollViewContent}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.userInfo}>
            <Image source={PLACEHOLDER_AVATAR} style={styles.avatar} />
            <View>
              <Text style={styles.greeting}>Hello {user?.name || 'User'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/profile')}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Create Custom Order</Text>
          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Order Description</Text>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your custom order (e.g.I feel like eating amala and ewedu — soft, warm amala served with smooth, flavorful ewedu soup. Please make it special by adding some rich gbegiri (bean soup), tasty assorted meats like beef, goat meat, shaki, pomo, and round it off with spicy stew on top. )"
              multiline
              numberOfLines={5}
            />
            <Text style={styles.inputLabel}>Send To</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={styles.radioItem}
                onPress={() => setSelectedOption('all')}
              >
                <View style={[styles.radioCircle, selectedOption === 'all' && styles.radioSelected]}>
                  {selectedOption === 'all' && <View style={styles.radioInnerCircle} />}
                </View>
                <Text style={styles.radioText}>All Restaurants</Text>
              </TouchableOpacity>
              {restaurants.map((restaurant) => (
                <TouchableOpacity
                  key={restaurant.id}
                  style={styles.radioItem}
                  onPress={() => setSelectedOption(restaurant.id)}
                >
                  <View style={[styles.radioCircle, selectedOption === restaurant.id && styles.radioSelected]}>
                    {selectedOption === restaurant.id && <View style={styles.radioInnerCircle} />}
                  </View>
                  <Text style={styles.radioText}>{restaurant.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Submit Custom Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, modalType === 'error' && styles.modalContentError]}>
            <Text style={styles.modalText}>
              {modalType === 'success' ? '✅ ' : '❌ '} {modalMessage}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setModalVisible(false);
                if (modalType === 'error' && modalMessage.includes('log in')) {
                  AsyncStorage.removeItem('id').then(() => router.replace('/login'));
                }
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ff5722" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  statusBarPlaceholder: {
    backgroundColor: '#f8f8f8',
  },
  scrollViewContent: {
    flexGrow: 1,
  },
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#ff5722',
  },
  greeting: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 5,
  },
  descriptionInput: {
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  radioGroup: {
    marginBottom: 20,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ff5722',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioSelected: {
    backgroundColor: '#ff5722',
  },
  radioInnerCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  radioText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#ff5722',
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    maxWidth: 350,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4ade80',
  },
  modalContentError: {
    borderColor: '#e63946',
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#ff5722',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});