import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { memo, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Placeholder image
const PLACEHOLDER_RECIPE = require('../assets/images/promo_burger.png');

// Interface for TypeScript
interface Recipe {
  id: string;
  name: string;
  description: string;
  price: string;
  image_url: string;
  category_id: string;
  restaurantId: string | number;
  vat_fee: string;
  delivery_fee: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Reusable RecipeCard component
const RecipeCard = memo(
  ({ recipe, onPress, onAddToCart, isMoreRecipes }: { recipe: Recipe; onPress: () => void; onAddToCart: () => void; isMoreRecipes?: boolean }) => (
    <TouchableOpacity
      style={isMoreRecipes ? styles.moreRecipeCard : styles.recipeCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${recipe.name} details`}
    >
      <Image
        source={
          recipe.image_url
            ? { uri: `https://cravii.ng/cravii/api/${recipe.image_url}` }
            : PLACEHOLDER_RECIPE
        }
        style={isMoreRecipes ? styles.moreRecipeImage : styles.recipeImage}
        onError={(e) => console.log(`Image load error for ${recipe.image_url}:`, e.nativeEvent.error)}
      />
      <View style={[styles.recipeInfo, isMoreRecipes ? styles.moreRecipeInfo : {}]}>
        <Text style={[styles.recipeName, isMoreRecipes ? styles.moreRecipeName : {}]}>{recipe.name}</Text>
        <Text 
          style={[styles.recipeDescription, isMoreRecipes ? styles.moreRecipeDescription : {}]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {recipe.description}
        </Text>
        <View style={styles.recipeFooter}>
          <Text style={[styles.recipePrice, isMoreRecipes ? styles.moreRecipePrice : {}]}>
            {`₦${recipe.price || '0.00'}`}
          </Text>
          <View style={styles.heartIcon}>
            <Feather name="heart" size={isMoreRecipes ? 16 : 16} color="#ff5722" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
);

export default function OrderNow() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [cartCount, setCartCount] = useState(0);

  // Fetch all recipes on mount
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const response = await fetch('https://cravii.ng/cravii/api/get_recipes.php', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const result: ApiResponse<Recipe[]> = await response.json();
        if (result.success) {
          console.log('Fetched Recipes:', result.data);
          setAllRecipes(result.data || []);
        } else {
          console.error('Failed to fetch recipes:', result.message);
          setAllRecipes([]);
        }
      } catch (error) {
        console.error('Error fetching recipes:', error);
        setAllRecipes([]);
      }
    };
    fetchRecipes();
  }, []);

  // Load cart count from AsyncStorage
  useEffect(() => {
    const loadCart = async () => {
      try {
        const cart = await AsyncStorage.getItem('cart');
        const cartItems = cart ? JSON.parse(cart) : [];
        const totalItems = cartItems.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
        setCartCount(totalItems);
      } catch (error) {
        console.error('Error loading cart:', error);
      }
    };
    loadCart();
  }, []);

  // Add to cart function
  const addToCart = async (recipe: Recipe) => {
    try {
      const cart = await AsyncStorage.getItem('cart');
      let cartItems = cart ? JSON.parse(cart) : [];
      const existingItem = cartItems.find((item: Recipe & { quantity: number }) => item.id === recipe.id);
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        cartItems.push({ ...recipe, quantity: 1 });
      }
      await AsyncStorage.setItem('cart', JSON.stringify(cartItems));
      const totalItems = cartItems.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
      setCartCount(totalItems);
      console.log('Added to cart:', recipe.name);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarPlaceholder, { height: insets.top, backgroundColor: '#ffffff' }]} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/')} accessibilityRole="button" accessibilityLabel="Go back to dashboard">
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Recipes</Text>
        <TouchableOpacity onPress={() => router.push('/cart')} accessibilityRole="button" accessibilityLabel="Go to cart">
          <View style={styles.cartIconContainer}>
            <Feather name="shopping-cart" size={24} color="#333" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollViewContent}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.recipeList}>
          {allRecipes.length > 0 ? (
            allRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                isMoreRecipes
                onPress={() =>
                  router.push({
                    pathname: '/recipe-details',
                    params: { id: recipe.id, name: recipe.name, description: recipe.description, price: recipe.price, image_url: recipe.image_url },
                  })
                }
                onAddToCart={() => addToCart(recipe)}
              />
            ))
          ) : (
            <Text style={styles.noRecipesText}>No recipes available</Text>
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
    justifyContent: 'space-between',
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
  },
  cartIconContainer: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#ff5722',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  recipeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingBottom: 30,
    justifyContent: 'space-between',
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: width * 0.6,
    marginRight: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  moreRecipeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: (width - 40) / 2,
    marginHorizontal: 5,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  moreRecipeImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  heartIcon: {
    backgroundColor: '#ff5722',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeInfo: {
    padding: 15,
  },
  moreRecipeInfo: {
    padding: 10,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 5,
  },
  moreRecipeName: {
    fontSize: 17,
  },
  recipeDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  moreRecipeDescription: {
    fontSize: 12,
  },
  recipeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  recipePrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#e63946',
  },
  moreRecipePrice: {
    fontSize: 17,
  },
  noRecipesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    width: '100%',
  },
});