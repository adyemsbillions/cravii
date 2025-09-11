import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

interface CartItem {
  id: string;
  name: string;
  price: string;
  image_url: string;
  restaurantId: string;
  quantity: number;
}

interface Fee {
  delivery_fee: string;
  vat_fee: string;
}

const { width } = Dimensions.get('window');
const PLACEHOLDER_AVATAR = require('../assets/images/avatar.jpg');

const fetchWithRetry = async (url: string, options: RequestInit, retries: number = 4, delay: number = 3000): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Fetch attempt ${i + 1} of ${retries} failed for ${url}: [Error: HTTP ${response.status}] - ${errorText}`);
        throw new Error(`HTTP ${response.status} - ${errorText}`);
      }
      console.log(`Fetch succeeded for ${url} on attempt ${i + 1}`);
      return response;
    } catch (error) {
      console.error(`Fetch attempt ${i + 1} of ${retries} failed for ${url}:`, error);
      if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      else throw error; // Rethrow on last attempt
    }
  }
  throw new Error(`Fetch failed after ${retries} attempts`);
};

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);
  const [name, setName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [userLocation, setUserLocation] = useState<string>('');
  const [restaurantAddress, setRestaurantAddress] = useState<string>('');
  const [total, setTotal] = useState<string>('0.00');
  const [showWebView, setShowWebView] = useState<boolean>(false);
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [showReloginModal, setShowReloginModal] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState<string>('');
  const [isCouponValid, setIsCouponValid] = useState<boolean>(false);
  const [fee, setFee] = useState<Fee | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [restaurantFetchError, setRestaurantFetchError] = useState<boolean>(false);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setRestaurantFetchError(false); // Reset error state
      try {
        const id = await AsyncStorage.getItem('id');
        console.log('Fetched user ID:', id);
        if (!id) {
          setShowReloginModal(true);
          setIsLoading(false);
          return;
        }

        const cart = await AsyncStorage.getItem('cart');
        let items: CartItem[] = [];
        if (cart) {
          items = JSON.parse(cart);
          setCartItems(items);
        }

        const fetchPromises = [
          fetchWithRetry(`https://cravii.ng/cravii/api/get_user.php?id=${id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          }),
          fetchWithRetry('https://cravii.ng/cravii/api/fetch_fee.php', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          }),
        ];

        // Fetch restaurant address if there are cart items
        if (items.length > 0 && items[0]?.restaurantId) {
          fetchPromises.push(
            fetchWithRetry(`https://cravii.ng/cravii/api/fetch_restaurant_address.php?restaurant_id=${items[0].restaurantId}`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            })
          );
        }

        const [userResponse, feeResponse, restaurantResponse] = await Promise.all(fetchPromises);

        const [userResult, feeResult, restaurantResult] = await Promise.all([
          userResponse.json(),
          feeResponse.json(),
          restaurantResponse ? restaurantResponse.json() : Promise.resolve(null),
        ]);

        console.log('User API response:', userResult);
        console.log('Fee API response:', feeResult);
        console.log('Restaurant API response:', restaurantResult);

        if (userResult.success) {
          const user = userResult.data;
          setName(user.name || '');
          setLocation(user.location || '');
          setDeliveryAddress(user.location || '');
        } else {
          setShowReloginModal(true);
          setIsLoading(false);
          return;
        }

        if (items.length > 0) {
          if (feeResult.success) {
            let fetchedFees = feeResult.data;
            if (restaurantResult?.success) {
              // Override fees if both restaurant address contains "unimaid" and userLocation contains "unimaid" or "university of maiduguri"
              if (
                restaurantResult.address.toLowerCase().includes('unimaid') &&
                (userLocation.toLowerCase().includes('unimaid') || userLocation.toLowerCase().includes('university of maiduguri'))
              ) {
                console.log('Fee override applied for restaurant address:', restaurantResult.address, 'and userLocation:', userLocation);
                fetchedFees = { delivery_fee: '200', vat_fee: '150' };
              }
              setRestaurantAddress(restaurantResult.address);
            } else {
              console.error('Failed to fetch restaurant address:', restaurantResult?.message || 'Unknown error');
              setRestaurantFetchError(true);
              Alert.alert(
                'Warning',
                'Unable to fetch restaurant details. Default fees are applied, which may not reflect Unimaid discounts.',
                [{ text: 'OK' }]
              );
              setRestaurantAddress('');
            }
            setFee(fetchedFees);
          } else {
            Alert.alert('Error', 'Failed to fetch fees. Please try again later.', [{ text: 'OK' }]);
            setIsLoading(false);
            return;
          }
          calculateTotal(items);
        }
      } catch (error) {
        console.error('Fetch data error:', error);
        if (String(error).includes('HTTP 403')) {
          setRestaurantFetchError(true);
          Alert.alert(
            'Warning',
            'Unable to fetch restaurant details due to server restrictions. Default fees are applied, which may not reflect Unimaid discounts.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', 'Failed to load data. Please check your network or try again later.', [{ text: 'OK' }]);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [userLocation]);

  useEffect(() => {
    if (cartItems.length > 0 && fee) {
      calculateTotal(cartItems);
    }
  }, [cartItems, fee, isCouponValid, userLocation]);

  useEffect(() => {
    if (showSuccessModal) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showSuccessModal]);

  const calculateTotal = (items: CartItem[]) => {
    if (!fee) return;
    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.price.replace('₦', '') || '0') * item.quantity, 0);
    let deliveryFee = parseFloat(fee.delivery_fee);
    let vatFee = parseFloat(fee.vat_fee); // Apply VAT fee once per purchase
    // Override fees if both restaurant address contains "unimaid" and userLocation contains "unimaid" or "university of maiduguri"
    if (
      restaurantAddress.toLowerCase().includes('unimaid') &&
      (userLocation.toLowerCase().includes('unimaid') || userLocation.toLowerCase().includes('university of maiduguri'))
    ) {
      console.log('Fee override applied in calculateTotal for restaurant address:', restaurantAddress, 'and userLocation:', userLocation);
      deliveryFee = 200;
      vatFee = 150;
    }
    const paystackFee = subtotal >= 2500 ? (subtotal * 0.015) + 100 : 0;
    const totalVatFee = isCouponValid ? vatFee * 0.8 : vatFee;
    const calculatedTotal = (subtotal + totalVatFee + paystackFee + deliveryFee).toFixed(2);
    setTotal(calculatedTotal);
  };

  const validateCoupon = async () => {
    try {
      const userId = await AsyncStorage.getItem('id');
      if (!userId || !couponCode) {
        Alert.alert('Error', 'Enter a coupon code and log in.', [{ text: 'OK' }]);
        return;
      }

      console.log('Validating coupon:', { userId, couponCode });
      const response = await fetchWithRetry(`https://cravii.ng/cravii/api/validate_coupon.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, coupon_code: couponCode }),
      });

      console.log('Response status:', response.status);
      const text = await response.text();
      console.log('Raw response:', text);
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseError) {
        console.log('JSON parse error:', parseError);
        throw new Error('Invalid response format');
      }
      console.log('Coupon validation response:', result);

      if (result.success) {
        setIsCouponValid(true);
        calculateTotal(cartItems);
        Alert.alert('Success', 'Coupon applied! 20% off VAT.', [{ text: 'OK' }]);
      } else {
        setIsCouponValid(false);
        calculateTotal(cartItems);
        Alert.alert('Error', result.message || 'Invalid coupon', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.log('Coupon validation error:', error);
      Alert.alert('Error', 'Coupon validation failed.', [{ text: 'OK' }]);
    }
  };

  const handlePayment = async () => {
    if (!deliveryAddress || !phoneNumber || !userLocation) {
      Alert.alert('Missing Info', 'Fill all delivery fields.', [{ text: 'OK' }]);
      return;
    }

    if (!fee) {
      Alert.alert('Error', 'Fee data not available. Please try again later.', [{ text: 'OK' }]);
      return;
    }

    const restaurantIds = new Set(cartItems.map(item => item.restaurantId));
    if (restaurantIds.size > 1) {
      console.log('Restaurant IDs:', [...restaurantIds]);
      Alert.alert('Restaurant Mismatch', 'Items must be from one restaurant.', [
        { text: 'Go to Cart', onPress: () => router.push('/cart') },
        { text: 'OK' },
      ]);
      return;
    }

    if (restaurantFetchError) {
      Alert.alert(
        'Warning',
        'Restaurant details unavailable. Proceeding with default fees, which may not reflect Unimaid discounts. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Proceed',
            onPress: async () => {
              await proceedWithPayment();
            },
          },
        ]
      );
    } else {
      await proceedWithPayment();
    }
  };

  const proceedWithPayment = async () => {
    setIsPaying(true);
    try {
      calculateTotal(cartItems);
      const subtotal = cartItems.reduce((sum, item) => sum + parseFloat(item.price.replace('₦', '') || '0') * item.quantity, 0);
      let deliveryFee = parseFloat(fee!.delivery_fee);
      let vatFee = parseFloat(fee!.vat_fee); // Apply VAT fee once per purchase
      // Override fees if both restaurant address contains "unimaid" and userLocation contains "unimaid" or "university of maiduguri"
      if (
        restaurantAddress.toLowerCase().includes('unimaid') &&
        (userLocation.toLowerCase().includes('unimaid') || userLocation.toLowerCase().includes('university of maiduguri'))
      ) {
        console.log('Fee override applied in handlePayment for restaurant address:', restaurantAddress, 'and userLocation:', userLocation);
        deliveryFee = 200;
        vatFee = 150;
      }
      const paystackFee = subtotal >= 2500 ? (subtotal * 0.015) + 100 : 0;
      const totalVatFee = isCouponValid ? vatFee * 0.8 : vatFee;
      const finalTotal = (subtotal + totalVatFee + paystackFee + deliveryFee).toFixed(2);
      console.log('Synced UI Total:', total, 'Final Total:', finalTotal);

      const payload = {
        deliveryAddress,
        phoneNumber,
        userLocation,
        cartItems,
        total: finalTotal,
        restaurant_id: cartItems[0]?.restaurantId || '1',
        vat_fee: totalVatFee.toFixed(2),
        delivery_fee: deliveryFee.toFixed(2),
        paystack_fee: paystackFee.toFixed(2),
      };

      const response = await fetchWithRetry('https://cravii.ng/cravii/api/process_checkout.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const rawResponse = await response.text();
      let result;
      try {
        result = JSON.parse(rawResponse);
      } catch (e) {
        throw new Error('Invalid JSON');
      }

      if (result.status === 'success' && result.authorization_url) {
        setPaymentUrl(result.authorization_url);
        setOrderId(result.order_id || null);
        setShowWebView(true);
      } else if (result.error && result.error.toLowerCase().includes('not logged in')) {
        setShowReloginModal(true);
      } else {
        Alert.alert('Payment Error', result.error || 'Try again.', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Payment error:', error);
      if (error.message.includes('HTTP 401') || (typeof error.message === 'string' && error.message.toLowerCase().includes('not logged in'))) {
        setShowReloginModal(true);
      } else {
        Alert.alert('Payment Error', error.message || 'Try again.', [{ text: 'OK' }]);
      }
    } finally {
      setIsPaying(false);
    }
  };

  const onNavigationStateChange = (navState: { url: string; loading: boolean }) => {
    if (navState.url.includes('success')) {
      AsyncStorage.removeItem('cart').then(() => {
        setCartItems([]);
        setTotal('0.00');
        setShowWebView(false);
        setPaymentUrl('');
        setShowSuccessModal(true);
        if (orderId) {
          fetchWithRetry('https://cravii.ng/cravii/api/success_email.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ order_id: orderId }),
          }).catch(() => {});
        }
      }).catch(() => {});
    } else if (navState.url.includes('cancel')) {
      setShowWebView(false);
      setPaymentUrl('');
      Alert.alert('Cancelled', 'Payment cancelled.', [{ text: 'OK' }]);
    }
  };

  const onWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    Alert.alert('Error', 'Failed to load payment.', [{ text: 'OK' }]);
    setShowWebView(false);
    setPaymentUrl('');
  };

  const subtotal = cartItems.reduce((sum, item) => sum + parseFloat(item.price.replace('₦', '') || '0') * item.quantity, 0);

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
              <Text style={styles.greeting}>Hello {name || 'User'}</Text>
              <View style={styles.location}>
                <Feather name="map-pin" size={16} color="#4ade80" />
                <Text style={styles.locationText}>{location || 'N.Y Bronx'}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={() => router.push('/cart')}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="City"
            value={deliveryAddress}
            onChangeText={setDeliveryAddress}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Delivery Location"
            value={userLocation}
            onChangeText={setUserLocation}
          />
          <TextInput
            style={styles.input}
            placeholder="Enter Coupon Code"
            value={couponCode}
            onChangeText={setCouponCode}
          />
          <TouchableOpacity style={styles.applyCouponButton} onPress={validateCoupon}>
            <Text style={styles.applyCouponText}>Apply Coupon</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
        </View>
        {isLoading ? (
          <Text style={styles.emptyCartText}>Loading...</Text>
        ) : cartItems.length === 0 ? (
          <Text style={styles.emptyCartText}>No items in cart.</Text>
        ) : (
          cartItems.map((item) => (
            <View key={item.id} style={styles.summaryItem}>
              <View>
                <Text style={styles.summaryName}>
                  {item.name} (x{item.quantity})
                </Text>
              </View>
              <Text style={styles.summaryPrice}>
                ₦{(parseFloat(item.price.replace('₦', '') || '0') * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))
        )}
        {cartItems.length > 0 && fee && !isLoading && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>
                ₦{subtotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>VAT ({isCouponValid ? '20% off' : ''}):</Text>
              <Text style={styles.summaryValue}>
                ₦{(isCouponValid ? (parseFloat(restaurantAddress.toLowerCase().includes('unimaid') && (userLocation.toLowerCase().includes('unimaid') || userLocation.toLowerCase().includes('university of maiduguri')) ? '150' : fee.vat_fee) * 0.8) : parseFloat(restaurantAddress.toLowerCase().includes('unimaid') && (userLocation.toLowerCase().includes('unimaid') || userLocation.toLowerCase().includes('university of maiduguri')) ? '150' : fee.vat_fee)).toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee:</Text>
              <Text style={styles.summaryValue}>
                ₦{(parseFloat(restaurantAddress.toLowerCase().includes('unimaid') && (userLocation.toLowerCase().includes('unimaid') || userLocation.toLowerCase().includes('university of maiduguri')) ? '200' : fee.delivery_fee)).toFixed(2)}
              </Text>
            </View>
            {subtotal >= 2500 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Paystack Fee:</Text>
                <Text style={styles.summaryValue}>
                  ₦{((subtotal * 0.015) + 100).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelTotal}>Total:</Text>
              <Text style={styles.summaryValueTotal}>{`₦${total}`}</Text>
            </View>
            {restaurantFetchError && (
              <Text style={styles.warningText}>
                Note: Using default fees due to unavailable restaurant details. Unimaid discounts may not apply.
              </Text>
            )}
          </View>
        )}
        <View style={[styles.deliveryCard, { marginTop: 15 }]}>
          <Text style={styles.deliveryText}>Safe and Fast Delivery by</Text>
          <Image
            source={{ uri: 'https://cravii.ng/cravii/api/images/satisfylogo.png' }}
            style={styles.deliveryLogo}
          />
        </View>
        {cartItems.length > 0 && !isLoading && (
          <TouchableOpacity
            style={[styles.payButton, isPaying && styles.payButtonDisabled]}
            onPress={handlePayment}
            disabled={isPaying}
          >
            {isPaying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.payText}>Pay Now</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
      {showWebView && (
        <View style={styles.webviewContainer}>
          <WebView
            ref={webviewRef}
            style={styles.webview}
            source={{ uri: paymentUrl }}
            onNavigationStateChange={onNavigationStateChange}
            onError={onWebViewError}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            cacheEnabled={false}
            cacheMode="LOAD_NO_CACHE"
          />
          <TouchableOpacity
            style={styles.closeWebViewButton}
            onPress={() => {
              setShowWebView(false);
              setPaymentUrl('');
            }}
          >
            <Text style={styles.closeWebViewText}>Close Payment</Text>
          </TouchableOpacity>
        </View>
      )}
      <Modal
        animationType="none"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.push('/');
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.successModalContainer, { opacity: fadeAnim }]}>
            <Feather name="check-circle" size={50} color="#4ade80" style={styles.successModalIcon} />
            <Text style={styles.successModalTitle}>Order Placed Successfully!</Text>
            <Text style={styles.successModalMessage}>
              Yum! Your order is on its way. You'll receive a confirmation soon, and our team is working to get your food to you fast!
            </Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowSuccessModal(false);
                router.push('/');
              }}
            >
              <Text style={styles.successModalButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent={true}
        visible={showReloginModal}
        onRequestClose={() => {
          setShowReloginModal(false);
          AsyncStorage.removeItem('id').then(() => router.replace('/login'));
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Feather name="lock" size={40} color="#ff5722" style={styles.modalIcon} />
            <Text style={styles.modalTitle}>Login Required</Text>
            <Text style={styles.modalMessage}>
              Oops! You need to login again to make payment, and dont worry your cart wont be cleared
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowReloginModal(false);
                AsyncStorage.removeItem('id').then(() => router.replace('/login'));
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
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
          <Feather name="user" size={24} color="#999" />
          <Text style={styles.navText}>Profile</Text>
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
    paddingHorizontal: 20,
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
  location: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  locationText: { fontSize: 14, color: '#333', fontWeight: '600', marginLeft: 5 },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
    marginTop: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
  inputContainer: { paddingHorizontal: 20, marginBottom: 20 },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  applyCouponButton: {
    backgroundColor: '#ff5722',
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  applyCouponText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginBottom: 5,
    borderRadius: 10,
  },
  summaryName: { fontSize: 16, color: '#333', fontWeight: '600' },
  summaryPrice: { fontSize: 16, color: '#4ade80', fontWeight: '600' },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: { fontSize: 16, color: '#333', fontWeight: '500' },
  summaryValue: { fontSize: 16, color: '#333', fontWeight: '500' },
  summaryLabelTotal: { fontSize: 18, color: '#333', fontWeight: '700' },
  summaryValueTotal: { fontSize: 18, color: '#e63946', fontWeight: '700' },
  warningText: {
    fontSize: 14,
    color: '#ff5722',
    textAlign: 'center',
    marginTop: 10,
  },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#333333',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deliveryText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    marginRight: 10,
  },
  deliveryLogo: {
    width: 100,
    height: 40,
    resizeMode: 'contain',
  },
  payButton: {
    backgroundColor: '#ff5722',
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
  },
  payButtonDisabled: {
    backgroundColor: '#ff8c66',
    opacity: 0.7,
  },
  payText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  webviewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
  },
  webview: { flex: 1, width: '100%' },
  closeWebViewButton: {
    backgroundColor: '#ff5722',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    margin: 20,
  },
  closeWebViewText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyCartText: { fontSize: 16, color: '#333', textAlign: 'center', marginTop: 20 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.8,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  modalIcon: {
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#ff5722',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successModalContainer: {
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
    borderColor: '#4ade80',
  },
  successModalIcon: {
    marginBottom: 20,
  },
  successModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  successModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  successModalButton: {
    backgroundColor: '#ff5722',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 30,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});