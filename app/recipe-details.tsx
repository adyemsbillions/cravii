"use client";

import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Recipe {
  id: string;
  name: string;
  description: string;
  price: string;
  image_url: string;
  category_id: string;
  restaurantId: string;
  vat_fee: string;
  delivery_fee: string;
}

const { width } = Dimensions.get("window");
const PLACEHOLDER_RECIPE = require("../assets/images/promo_burger.png");

const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retries: number = 4,
  initialDelay: number = 300,
  timeout: number = 10000 // 10 seconds timeout
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
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        headers: defaultHeaders,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const responseHeaders = Object.fromEntries(response.headers.entries());
        if (__DEV__) {
          console.error(
            `Fetch attempt ${i + 1} of ${retries} failed for ${url}: [Error: HTTP ${response.status}] - ${errorText}`,
            {
              headers: responseHeaders,
              payload: options.body ? JSON.parse(options.body as string) : null,
            }
          );
        }
        if (response.status === 403 && i < retries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          if (__DEV__) console.log(`Waiting ${delay}ms before retrying with User-Agent: ${currentUserAgent}...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`HTTP ${response.status} - ${errorText}`);
      }

      if (__DEV__) console.log(`Fetch succeeded for ${url} on attempt ${i + 1}`);
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        await AsyncStorage.setItem('sessionCookie', setCookie);
      }
      return response;
    } catch (error: any) {
      if (__DEV__) console.error(`Fetch attempt ${i + 1} of ${retries} failed for ${url}:`, error);
      if (i < retries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        if (__DEV__) console.log(`Waiting ${delay}ms before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw new Error(`Fetch failed after ${retries} attempts: ${error.message}`);
      }
    }
  }
  throw new Error(`Fetch failed after ${retries} attempts`);
};

export default function RecipeDetails() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, name, description, price, image_url } = useLocalSearchParams() as {
    id: string;
    name: string;
    description: string;
    price: string;
    image_url: string;
  };

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [retryCount, setRetryCount] = useState<number>(0);
  const MAX_RETRIES = 3;

  const fetchRecipeDetails = async () => {
    try {
      setLoading(true);
      setErrorMessage(""); // Clear previous error messages

      // Check for cached recipe data
      const cachedRecipe = await AsyncStorage.getItem(`recipe_${id}`);
      if (cachedRecipe) {
        setRecipe(JSON.parse(cachedRecipe));
      }

      const cachedRestaurant = await AsyncStorage.getItem(`restaurant_${id}`);
      if (cachedRestaurant) {
        setRestaurantName(JSON.parse(cachedRestaurant).name);
      }

      // Fetch user data to get location
      const userId = await AsyncStorage.getItem('id');
      if (userId) {
        try {
          const userResponse = await fetchWithRetry(`https://cravii.ng/cravii/api/get_user.php?id=${userId}`, {
            method: 'GET',
            credentials: 'include',
          });
          const userResult = await userResponse.json();
          if (__DEV__) console.log('User API response:', userResult);
          if (userResult.success) {
            await AsyncStorage.setItem('userLocation', userResult.data.location || 'N.Y Bronx');
          } else {
            if (__DEV__) console.error('User fetch failed:', userResult?.message || 'Unknown error');
            await AsyncStorage.setItem('userLocation', 'N.Y Bronx');
          }
        } catch (userError: any) {
          if (__DEV__) console.error('User fetch failed:', userError);
          await AsyncStorage.setItem('userLocation', 'N.Y Bronx');
        }
      } else {
        if (__DEV__) console.warn('No user ID found. Defaulting to fallback location.');
        await AsyncStorage.setItem('userLocation', 'N.Y Bronx');
      }

      // Fetch recipe details
      const response = await fetchWithRetry(`https://cravii.ng/cravii/api/get_recipe.php?id=${id}`, {
        method: 'GET',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setRecipe(result.data);
        await AsyncStorage.setItem(`recipe_${id}`, JSON.stringify(result.data));
        if (result.data.restaurantId) {
          const restaurantResponse = await fetchWithRetry(
            `https://cravii.ng/cravii/api/get_restaurant.php?id=${result.data.restaurantId}`,
            {
              method: 'GET',
              credentials: 'include',
            }
          );
          const restaurantResult = await restaurantResponse.json();
          if (restaurantResult.success) {
            setRestaurantName(restaurantResult.data.name);
            await AsyncStorage.setItem(`restaurant_${id}`, JSON.stringify(restaurantResult.data));
          } else {
            if (__DEV__) console.error('Failed to fetch restaurant name:', restaurantResult.message);
            setRestaurantName('Unknown Restaurant');
          }
        }
      } else {
        if (__DEV__) console.error('Failed to fetch recipe details:', result.message);
        setErrorMessage('Failed to load recipe details. Please try again.');
      }
    } catch (error: any) {
      if (error.message.includes('Network request failed') || error.message.includes('Fetch failed after') || error.name === 'AbortError') {
        setErrorMessage(retryCount >= MAX_RETRIES ? 'Still no connection. Please check your internet and try again later.' : 'Internet is not stable');
      } else {
        setErrorMessage('Failed to load recipe details. Please try again.');
        if (__DEV__) console.error('Error fetching recipe details:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipeDetails();
  }, [id]);

  const handleRetry = () => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount(retryCount + 1);
      fetchRecipeDetails();
    }
  };

  const handleAddToCart = async () => {
    try {
      if (!recipe) {
        setErrorMessage('Recipe details not loaded. Please try again.');
        return;
      }
      const cart = await AsyncStorage.getItem('cart');
      const cartItems = cart ? JSON.parse(cart) : [];
      const itemExists = cartItems.some((item: Recipe) => item.id === id);
      if (itemExists) {
        setErrorMessage(`${recipe.name} is already in your cart. You can adjust the quantity in the cart.`);
        return;
      }
      const newItem = {
        id,
        name: recipe.name,
        price: recipe.price,
        image_url: recipe.image_url,
        restaurantId: recipe.restaurantId,
        vat_fee: recipe.vat_fee,
        delivery_fee: recipe.delivery_fee,
        quantity: 1,
      };
      cartItems.push(newItem);
      await AsyncStorage.setItem('cart', JSON.stringify(cartItems));
      if (__DEV__) console.log(`Added ${recipe.name} to cart`);
      router.push('/cart');
    } catch (error) {
      if (__DEV__) console.error('Error adding to cart:', error);
      setErrorMessage('Failed to add item to cart. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarPlaceholder, { backgroundColor: '#ffffff' }]} />
      <ScrollView style={styles.scrollViewContent} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff5722" />
            <Text style={styles.loadingText}>Loading recipe details...</Text>
          </View>
        ) : errorMessage && !recipe ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            {retryCount < MAX_RETRIES && (
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <Image
              source={
                recipe?.image_url ? { uri: `https://cravii.ng/cravii/api/uploads/${recipe.image_url}` } : PLACEHOLDER_RECIPE
              }
              style={styles.detailImage}
              onError={(e) => { if (__DEV__) console.log(`Image load error for ${recipe?.image_url}:`, e.nativeEvent.error); }}
            />
            <View style={styles.detailsContainer}>
              <Text style={styles.detailName}>{recipe?.name || name || 'Recipe Name'}</Text>
              <Text style={styles.restaurantName}>From: {restaurantName || 'Unknown Restaurant'}</Text>
              <Text style={styles.detailDescription}>{recipe?.description || description || 'No description available.'}</Text>
              <Text style={styles.detailPrice}>{`₦${recipe?.price || price || '0.00'}`}</Text>
              {errorMessage && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                  {retryCount < MAX_RETRIES && (
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
                <Text style={styles.addToCartText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Feather name='arrow-left' size={24} color='#fff' />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  statusBarPlaceholder: {
    height: StatusBar.currentHeight || 0,
  },
  scrollViewContent: {
    flex: 1,
  },
  detailImage: {
    width: '100%',
    height: 320,
    resizeMode: 'cover',
  },
  detailsContainer: {
    backgroundColor: '#ffffff',
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  detailName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
    lineHeight: 38,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 16,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  detailDescription: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
    lineHeight: 26,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e2e8f0',
  },
  detailPrice: {
    fontSize: 36,
    fontWeight: '900',
    color: '#dc2626',
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  addToCartButton: {
    backgroundColor: '#ff5722',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#ff5722',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#ff7043',
  },
  addToCartText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#ffe6e6',
    marginHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#e63946',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#ff5722',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 10,
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
    marginTop: 10,
    fontWeight: '600',
  },
});