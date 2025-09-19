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

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);
  const [name, setName] = useState<string>('User');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [userLocation, setUserLocation] = useState<string>('');
  const [restaurantAddress, setRestaurantAddress] = useState<string>('');
  const [total, setTotal] = useState<string>('0.00');
  const [showWebView, setShowWebView] = useState<boolean>(false);
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [showLoginPromptModal, setShowLoginPromptModal] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [showClosedHoursModal, setShowClosedHoursModal] = useState<boolean>(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState<string>('');
  const [isCouponValid, setIsCouponValid] = useState<boolean>(false);
  const [fee, setFee] = useState<Fee>({ delivery_fee: '500', vat_fee: '200' });
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showCouponSuccessModal, setShowCouponSuccessModal] = useState<boolean>(false);
  const [showCouponErrorModal, setShowCouponErrorModal] = useState<boolean>(false);
  const [couponErrorMessage, setCouponErrorMessage] = useState<string>('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const id = await AsyncStorage.getItem('id');
        console.log('Fetched user ID:', id);
        if (!id) {
          setShowLoginPromptModal(true);
          return;
        }

        const cart = await AsyncStorage.getItem('cart');
        let items: CartItem[] = [];
        if (cart) {
          items = JSON.parse(cart);
          setCartItems(items);
        }

        // Fetch user data
        try {
          const userResponse = await fetchWithRetry(`https://cravii.ng/cravii/api/get_user.php?id=${id}`, {
            method: 'GET',
            credentials: 'include',
          });
          const userResult = await userResponse.json();
          console.log('User API response:', userResult);
          if (userResult.success) {
            const user = userResult.data;
            setName(user.name || '');
            setDeliveryAddress(user.location || '');
          } else {
            console.error('User fetch failed:', userResult?.message || 'Unknown error');
          }
        } catch (userError) {
          console.error('User fetch failed:', userError);
        }

        // Fetch fees
        try {
          const feeResponse = await fetchWithRetry('https://cravii.ng/cravii/api/fetch_fee.php', {
            method: 'GET',
            credentials: 'include',
          });
          const feeResult = await feeResponse.json();
          console.log('Fee API response:', feeResult);
          if (feeResult.success) {
            setFee(feeResult.data);
          } else {
            console.error('Fee fetch failed:', feeResult?.message || 'Unknown error');
          }
        } catch (feeError) {
          console.error('Fee fetch failed:', feeError);
        }

        if (items.length > 0) {
          if (items[0]?.restaurantId) {
            try {
              const restaurantResponse = await fetchWithRetry(
                `https://cravii.ng/cravii/api/fetch_restaurant_address.php?restaurant_id=${items[0].restaurantId}`,
                {
                  method: 'GET',
                  credentials: 'include',
                }
              );
              const restaurantResult = await restaurantResponse.json();
              console.log('Restaurant API response:', restaurantResult);
              if (restaurantResult?.success) {
                setRestaurantAddress(restaurantResult.address);
              } else {
                console.error('Failed to fetch restaurant address:', restaurantResult?.message || 'Unknown error');
              }
            } catch (restaurantError) {
              console.error('Restaurant address fetch failed:', restaurantError);
            }
          }
          calculateTotal(items);
        }
      } catch (error) {
        console.error('Fetch data error:', error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (cartItems.length > 0 && fee) {
      calculateTotal(cartItems);
    }
  }, [cartItems, fee, isCouponValid, userLocation]);

  // Reset fadeAnim when modals close
  useEffect(() => {
    if (!showSuccessModal && !showLoginPromptModal && !showClosedHoursModal && !showCouponSuccessModal && !showCouponErrorModal) {
      fadeAnim.setValue(0);
    }
  }, [showSuccessModal, showLoginPromptModal, showClosedHoursModal, showCouponSuccessModal, showCouponErrorModal]);

  // Start animation for modals
  useEffect(() => {
    if (showSuccessModal || showLoginPromptModal || showClosedHoursModal || showCouponSuccessModal || showCouponErrorModal) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showSuccessModal, showLoginPromptModal, showClosedHoursModal, showCouponSuccessModal, showCouponErrorModal]);

  const calculateTotal = (items: CartItem[]) => {
    if (!fee) return;
    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.price.replace('₦', '') || '0') * item.quantity, 0);
    let deliveryFee = parseFloat(fee.delivery_fee);
    let vatFee = parseFloat(fee.vat_fee);
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
        console.log('Coupon validation skipped: No user ID or coupon code');
        setIsCouponValid(false);
        calculateTotal(cartItems);
        return;
      }

      console.log('Validating coupon:', { userId, couponCode });
      const response = await fetchWithRetry(`https://cravii.ng/cravii/api/validate_coupon.php`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, coupon_code: couponCode }),
      });

      const text = await response.text();
      console.log('Raw response:', text);
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        setIsCouponValid(false);
        calculateTotal(cartItems);
        return;
      }
      console.log('Coupon validation response:', result);

      if (result.success) {
        setIsCouponValid(true);
        calculateTotal(cartItems);
        setShowCouponSuccessModal(true);
      } else {
        if (result.message && result.message.toLowerCase().includes('already redeemed')) {
          setCouponErrorMessage('You have already redeemed this coupon.');
          setShowCouponErrorModal(true);
        } else if (userId) { // Assume existing userId indicates not a new user
          setCouponErrorMessage('Not eligible for new user coupon.');
          setShowCouponErrorModal(true);
        }
        setIsCouponValid(false);
        calculateTotal(cartItems);
      }
    } catch (error) {
      console.error('Coupon validation error:', error);
      setIsCouponValid(false);
      calculateTotal(cartItems);
    }
  };

  const handlePayment = async () => {
    if (!deliveryAddress || !phoneNumber || !userLocation) {
      console.log('Payment blocked: Missing delivery fields');
      setErrorMessage('Please fill all delivery fields.');
      return;
    }

    if (!fee) {
      console.log('Payment blocked: Fee data not available');
      setErrorMessage('Unable to process payment. Please try again later.');
      return;
    }

    const restaurantIds = new Set(cartItems.map((item) => item.restaurantId));
    if (restaurantIds.size > 1) {
      console.log('Payment blocked: Items from multiple restaurants:', [...restaurantIds]);
      setErrorMessage('Items from multiple restaurants cannot be checked out together.');
      return;
    }

    // Check if current time is between 9 PM and 6 AM WAT (UTC+1)
    const now = new Date();
    const watOffset = 1 * 60; // WAT is UTC+1 (1 hour = 60 minutes)
    const watTime = new Date(now.getTime() + watOffset * 60 * 1000);
    const hours = watTime.getUTCHours();
    console.log('WAT Time:', watTime.toISOString(), 'Hours:', hours);
    if (hours >= 21 || hours < 6) {
      setShowClosedHoursModal(true);
    } else {
      await proceedWithPayment();
    }
  };

  const proceedWithPayment = async () => {
    setIsPaying(true);
    setErrorMessage(''); // Clear any previous error message
    try {
      calculateTotal(cartItems);
      const subtotal = cartItems.reduce((sum, item) => sum + parseFloat(item.price.replace('₦', '') || '0') * item.quantity, 0);
      let deliveryFee = parseFloat(fee!.delivery_fee);
      let vatFee = parseFloat(fee!.vat_fee);
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
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const rawResponse = await response.text();
      let result;
      try {
        result = JSON.parse(rawResponse);
      } catch (e) {
        console.error('Invalid JSON response:', e);
        setErrorMessage('Invalid server response. Please try again.');
        return;
      }

      if (result.status === 'success' && result.authorization_url) {
        setPaymentUrl(result.authorization_url);
        setOrderId(result.order_id || null);
        setShowWebView(true);
      } else if (result.error && result.error.toLowerCase().includes('not logged in')) {
        setShowLoginPromptModal(true);
      } else {
        setErrorMessage('Payment processing failed. Please try again.');
      }
    } catch (error) {
      const errorMsg = error.message || 'An unexpected error occurred.';
      if (errorMsg.includes('HTTP 401') || errorMsg.toLowerCase().includes('not logged in')) {
        setShowLoginPromptModal(true);
      } else {
        setErrorMessage('Failed to process payment. Please check your connection and try again.');
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
            credentials: 'include',
            body: JSON.stringify({ order_id: orderId }),
          }).catch(() => {});
        }
      }).catch(() => {});
    } else if (navState.url.includes('cancel')) {
      setShowWebView(false);
      setPaymentUrl('');
    }
  };

  const onWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setShowWebView(false);
    setPaymentUrl('');
    setErrorMessage('Payment gateway error. Please try again.');
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
              <Text style={styles.greeting}>Hello {name}</Text>
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
          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="City"
            value={deliveryAddress}
            onChangeText={setDeliveryAddress}
          />
          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
          <Text style={styles.inputLabel}>Delivery Location</Text>
          <TextInput
            style={styles.input}
            placeholder="Delivery Location"
            value={userLocation}
            onChangeText={setUserLocation}
          />
          <Text style={styles.inputLabel}>Coupon Code</Text>
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
        {cartItems.map((item) => (
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
        ))}
        {cartItems.length > 0 && fee && (
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
          </View>
        )}
        <View style={[styles.deliveryCard, { marginTop: 15 }]}>
          <Text style={styles.deliveryText}>Safe and Fast Delivery by</Text>
          <Image
            source={{ uri: 'https://cravii.ng/cravii/api/images/satisfylogo.png' }}
            style={styles.deliveryLogo}
          />
        </View>
        {cartItems.length > 0 && (
          <View>
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
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
          </View>
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
        visible={showLoginPromptModal}
        onRequestClose={() => {
          setShowLoginPromptModal(false);
          AsyncStorage.removeItem('id').then(() => router.replace('/login'));
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.successModalContainer, { opacity: fadeAnim }]}>
            <Feather name="lock" size={50} color="#ff5722" style={styles.successModalIcon} />
            <Text style={styles.successModalTitle}>Please Login to Checkout</Text>
            <Text style={styles.successModalMessage}>
              Please login to checkout. Note: Your cart items are still there.
            </Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowLoginPromptModal(false);
                AsyncStorage.removeItem('id').then(() => router.replace('/login'));
              }}
            >
              <Text style={styles.successModalButtonText}>OK</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent={true}
        visible={showClosedHoursModal}
        onRequestClose={() => setShowClosedHoursModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.successModalContainer, { opacity: fadeAnim }]}>
            <Feather name="clock" size={50} color="#ff5722" style={styles.successModalIcon} />
            <Text style={styles.successModalTitle}>We Are Closed</Text>
            <Text style={styles.successModalMessage}>
              We are closed for the day. All orders placed now will be delivered from 6 AM.
            </Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.successModalButton, styles.cancelButton]}
                onPress={() => setShowClosedHoursModal(false)}
              >
                <Text style={styles.successModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.successModalButton}
                onPress={() => {
                  setShowClosedHoursModal(false);
                  proceedWithPayment();
                }}
              >
                <Text style={styles.successModalButtonText}>Proceed</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
      <Modal
        animationType="none"
        transparent={true}
        visible={showCouponSuccessModal}
        onRequestClose={() => setShowCouponSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.successModalContainer, { opacity: fadeAnim }]}>
            <Feather name="check-circle" size={50} color="#4ade80" style={styles.successModalIcon} />
            <Text style={styles.successModalTitle}>Coupon Applied Successfully!</Text>
            <Text style={styles.successModalMessage}>
              Your coupon has been applied. Enjoy the discount on your order!
            </Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowCouponSuccessModal(false);
                calculateTotal(cartItems); // Recalculate total to ensure it reflects the coupon
              }}
            >
              <Text style={styles.successModalButtonText}>OK</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
      <Modal
        animationType="none"
        transparent={true}
        visible={showCouponErrorModal}
        onRequestClose={() => setShowCouponErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.errorModalContainer, { opacity: fadeAnim }]}>
            <Feather name="x-circle" size={50} color="#e63946" style={styles.successModalIcon} />
            <Text style={styles.successModalTitle}>Coupon Error</Text>
            <Text style={styles.successModalMessage}>
              {couponErrorMessage}
            </Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowCouponErrorModal(false);
                setCouponErrorMessage('');
              }}
            >
              <Text style={styles.successModalButtonText}>OK</Text>
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
  inputLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 5,
    marginLeft: 5,
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
    fontWeight: '600',
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
  errorModalContainer: {
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
    borderColor: '#e63946',
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
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: '#999',
    marginRight: 10,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '90%',
    flexWrap: 'wrap',
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#e63946',
    textAlign: 'center',
    marginTop: 5,
    fontSize: 14,
  },
});