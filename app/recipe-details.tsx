"use client";

import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
        console.error(
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
      console.error(`Fetch attempt ${i + 1} of ${retries} failed for ${url}:`, error);
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

  useEffect(() => {
    const fetchRecipeDetails = async () => {
      try {
        // Fetch user data to get location
        const userId = await AsyncStorage.getItem('id');
        if (userId) {
          try {
            const userResponse = await fetchWithRetry(`https://cravii.ng/cravii/api/get_user.php?id=${userId}`, {
              method: 'GET',
              credentials: 'include',
            });
            const userResult = await userResponse.json();
            console.log('User API response:', userResult);
            if (userResult.success) {
              await AsyncStorage.setItem('userLocation', userResult.data.location || 'N.Y Bronx');
            } else {
              console.error('User fetch failed:', userResult?.message || 'Unknown error');
              await AsyncStorage.setItem('userLocation', 'N.Y Bronx');
            }
          } catch (userError) {
            console.error('User fetch failed:', userError);
            await AsyncStorage.setItem('userLocation', 'N.Y Bronx');
          }
        } else {
          console.warn('No user ID found. Defaulting to fallback location.');
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
            } else {
              console.error('Failed to fetch restaurant name:', restaurantResult.message);
              setRestaurantName('Unknown Restaurant');
            }
          }
        } else {
          console.error('Failed to fetch recipe details:', result.message);
          Alert.alert('Error', 'Failed to load recipe details. Please try again.');
        }
      } catch (error) {
        console.error('Error fetching recipe details:', error);
        Alert.alert('Error', 'Failed to load recipe details. Please check your connection and try again.');
      }
    };
    fetchRecipeDetails();
  }, [id]);

  const handleAddToCart = async () => {
    try {
      if (!recipe) {
        Alert.alert('Error', 'Recipe details not loaded. Please try again.');
        return;
      }
      const cart = await AsyncStorage.getItem('cart');
      const cartItems = cart ? JSON.parse(cart) : [];
      const itemExists = cartItems.some((item: Recipe) => item.id === id);
      if (itemExists) {
        Alert.alert(
          'Item Already in Cart',
          `${recipe.name} is already in your cart. You can adjust the quantity in the cart.`,
          [{ text: 'Go to Cart', onPress: () => router.push('/cart') }, { text: 'OK' }],
        );
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
      console.log(`Added ${recipe.name} to cart`);
      router.push('/cart');
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add item to cart. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarPlaceholder, { backgroundColor: '#ffffff' }]} />
      <ScrollView style={styles.scrollViewContent} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        <Image
          source={
            recipe?.image_url ? { uri: `https://cravii.ng/cravii/api/uploads/${recipe.image_url}` } : PLACEHOLDER_RECIPE
          }
          style={styles.detailImage}
          onError={(e) => console.log(`Image load error for ${recipe?.image_url}:`, e.nativeEvent.error)}
        />
        <View style={styles.detailsContainer}>
          <Text style={styles.detailName}>{recipe?.name || 'Recipe Name'}</Text>
          <Text style={styles.restaurantName}>From: {restaurantName || 'Unknown Restaurant'}</Text>
          <Text style={styles.detailDescription}>{recipe?.description || 'No description available.'}</Text>
          <Text style={styles.detailPrice}>{`₦${recipe?.price || '0.00'}`}</Text>
          <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
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
});