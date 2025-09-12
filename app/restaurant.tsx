import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { memo, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Placeholder images
const PLACEHOLDER_AVATAR = require('../assets/images/avatar.jpg');
const PLACEHOLDER_CATEGORY = require('../assets/images/burger_category.jpg');
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

interface Category {
  id: string;
  name: string;
  image_url: string;
}

interface User {
  name: string;
  location: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Reusable RecipeCard component
const RecipeCard = memo(
  ({
    recipe,
    onPress,
    onLikeToggle,
    isLiked,
    isMoreRecipes,
  }: {
    recipe: Recipe;
    onPress: () => void;
    onLikeToggle: () => void;
    isLiked: boolean;
    isMoreRecipes?: boolean;
  }) => (
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
          <TouchableOpacity style={styles.heartIcon} onPress={onLikeToggle}>
            <Feather
              name="heart"
              size={isMoreRecipes ? 16 : 16}
              color={isLiked ? '#ff5722' : '#999'}
              style={isLiked ? styles.heartIconFilled : {}}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
);

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // State for user data
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  // State for dynamic data
  const [categories, setCategories] = useState<Category[]>([]);
  const [popularRecipes, setPopularRecipes] = useState<Recipe[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [moreRecipes, setMoreRecipes] = useState<Recipe[]>([]);
  // State for search
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // State for cart and notification counts
  const [cartCount, setCartCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  // State for liked recipes
  const [likedRecipes, setLikedRecipes] = useState<string[]>([]);
  // State for error message
  const [errorMessage, setErrorMessage] = useState('');

  // Shuffle function to randomize array
  const shuffleArray = (array: Recipe[]): Recipe[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 20); // Take up to 20 recipes
  };

  // Search function for suggestions
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSuggestions([]);
      setMoreRecipes(shuffleArray(allRecipes));
    } else {
      const filtered = allRecipes
        .filter((recipe) => recipe.name.toLowerCase().includes(query.toLowerCase()))
        .map((recipe) => recipe.name);
      setSuggestions(filtered.slice(0, 5)); // Show up to 5 suggestions
    }
  };

  // Handle Enter key press to navigate
  const handleKeyPress = (event: any) => {
    if (event.nativeEvent.key === 'Enter' && searchQuery.trim() !== '') {
      router.push({
        pathname: '/search-results',
        params: { query: searchQuery },
      });
    }
  };

  // Handle search icon click to navigate
  const handleSearchIconPress = () => {
    if (searchQuery.trim() !== '') {
      router.push({
        pathname: '/search-results',
        params: { query: searchQuery },
      });
    }
  };

  // Toggle like function
  const toggleLike = async (recipe: Recipe) => {
    try {
      const likes = await AsyncStorage.getItem('likes');
      let likedItems: Recipe[] = likes ? JSON.parse(likes) : [];
      const isCurrentlyLiked = likedItems.some((item) => item.id === recipe.id);

      if (isCurrentlyLiked) {
        // Unlike: Remove from likes
        likedItems = likedItems.filter((item) => item.id !== recipe.id);
        setLikedRecipes(likedRecipes.filter((id) => id !== recipe.id));
        console.log('Removed from likes:', recipe.name);
      } else {
        // Like: Add to likes
        likedItems.push(recipe);
        setLikedRecipes([...likedRecipes, recipe.id]);
        console.log('Added to likes:', recipe.name);
      }

      await AsyncStorage.setItem('likes', JSON.stringify(likedItems));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Fetch user data, dynamic content, cart count, notification count, and liked recipes on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setErrorMessage(''); // Clear previous error messages

        // Fetch user data
        const id = await AsyncStorage.getItem('id');
        if (id) {
          const userResponse = await fetch(`https://cravii.ng/cravii/api/get_user.php?id=${id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
          });
          const userResult: ApiResponse<User> = await userResponse.json();
          if (userResult.success) {
            const user = userResult.data;
            setName(user.name || '');
            setLocation(user.location || '');
          } else {
            console.error('Failed to fetch user data:', userResult.message);
          }
        } else {
          console.warn('No user ID found. Defaulting to empty name and location.');
        }

        // Fetch categories
        const categoriesResponse = await fetch('https://cravii.ng/cravii/api/get_categories.php', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        const categoriesResult: ApiResponse<Category[]> = await categoriesResponse.json();
        if (categoriesResult.success) {
          console.log('Fetched Categories:', categoriesResult.data);
          setCategories(categoriesResult.data || []);
        } else {
          console.error('Failed to fetch categories:', categoriesResult.message);
          setCategories([]);
        }

        // Fetch all recipes
        const recipesResponse = await fetch('https://cravii.ng/cravii/api/get_recipes.php', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        const recipesResult: ApiResponse<Recipe[]> = await recipesResponse.json();
        if (recipesResult.success) {
          console.log('Fetched Recipes:', recipesResult.data);
          const fetchedRecipes = recipesResult.data || [];
          setAllRecipes(fetchedRecipes);
          setPopularRecipes(shuffleArray(fetchedRecipes).slice(0, 5));
          setMoreRecipes(shuffleArray(fetchedRecipes));
        } else {
          console.error('Failed to fetch recipes:', recipesResult.message);
          setAllRecipes([]);
          setPopularRecipes([]);
          setMoreRecipes([]);
        }

        // Fetch cart count
        const cart = await AsyncStorage.getItem('cart');
        const cartItems = cart ? JSON.parse(cart) : [];
        const totalItems = cartItems.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
        setCartCount(totalItems);

        // Fetch notification count
        const notificationsResponse = await fetch(`https://cravii.ng/cravii/api/get_notifications.php?user_id=${id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        const notificationsResult = await notificationsResponse.json();
        if (notificationsResult.success) {
          const unreadCount = notificationsResult.data.filter((notification: { is_read: boolean }) => !notification.is_read).length;
          setNotificationCount(unreadCount);
        } else {
          console.error('Failed to fetch notifications:', notificationsResult.message);
          setNotificationCount(0);
        }

        // Fetch liked recipes
        const likes = await AsyncStorage.getItem('likes');
        const likedItems: Recipe[] = likes ? JSON.parse(likes) : [];
        setLikedRecipes(likedItems.map((item) => item.id));
      } catch (error: any) {
        if (error.message.includes('Network request failed')) {
          setErrorMessage('Internet is not stable');
        } else {
          setErrorMessage('An error occurred while fetching data');
          console.error('Error fetching data:', error);
        }
      }
    };
    fetchData();
  }, []);

  // Shuffle popularRecipes and moreRecipes every hour
  useEffect(() => {
    const interval = setInterval(() => {
      if (allRecipes.length > 0 && searchQuery.trim() === '') {
        console.log('Shuffling recipes');
        setPopularRecipes(shuffleArray(allRecipes).slice(0, 5));
        setMoreRecipes(shuffleArray(allRecipes));
      }
    }, 3600 * 1000); // Every hour
    return () => clearInterval(interval);
  }, [allRecipes, searchQuery]);

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarPlaceholder, { height: insets.top, backgroundColor: '#ffffff' }]} />
      <ScrollView
        style={styles.scrollViewContent}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Error Message Display */}
        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top, backgroundColor: '#ffffff' }]}>
              <View style={styles.userInfo}>
                <TouchableOpacity onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Go to profile">
                  <Image source={PLACEHOLDER_AVATAR} style={styles.avatar} />
                </TouchableOpacity>
                <View>
                  <Text style={styles.greeting}>Hello {name || 'User'}</Text>
                  <View style={styles.location}>
                    <Feather name="map-pin" size={16} color="#4ade80" />
                    <Text style={styles.locationText}>{location || 'N.Y Bronx'}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.notificationButton}
                onPress={() => router.push('/notification')}
                accessibilityRole="button"
                accessibilityLabel="View notifications"
              >
                <View style={styles.navIconContainer}>
                  <Feather name="bell" size={24} color="#ff5722" />
                  {notificationCount > 0 && (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>{notificationCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Search Section */}
            <View style={styles.searchSection}>
              <Text style={styles.searchTitle}>What Service Do You Want?</Text>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder='Search Any recipe..'
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  onKeyPress={handleKeyPress}
                />
                <TouchableOpacity onPress={handleSearchIconPress}>
                  <Feather name="search" size={20} color="#666" style={styles.searchIcon} />
                </TouchableOpacity>
              </View>
              {suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => router.push({
                        pathname: '/search-results',
                        params: { query: suggestion },
                      })}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Promotional Banner */}
            <View style={styles.promoBanner}>
              <View style={styles.promoTextContainer}>
                <Text style={styles.promoTitle}>
                  Fast Bites<Text>{"\n"}</Text>Faster Orders.
                </Text>
                <Text style={styles.promoSubtitle}>Satisfy Your Cravings</Text>
                <TouchableOpacity
                  style={styles.orderNowButton}
                  onPress={() => router.push('/order-now')}
                >
                  <Text style={styles.orderNowButtonText}>Order Now</Text>
                </TouchableOpacity>
              </View>
              <Image source={PLACEHOLDER_RECIPE} style={styles.promoBurgerImage} />
            </View>

            {/* Service Categories */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Service Categories</Text>
              <TouchableOpacity>
                <Ionicons name="arrow-forward" size={20} color="black" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              {categories.map((category, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.categoryItem}
                  onPress={() =>
                    router.push({
                      pathname: '/categories',
                      params: { id: category.id, name: category.name },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`View ${category.name} recipes`}
                >
                  <View style={styles.categoryImageWrapper}>
                    <Image
                      source={
                        category.image_url
                          ? { uri: `https://cravii.ng/cravii/api/restaurant/${category.image_url}` }
                          : PLACEHOLDER_CATEGORY
                      }
                      style={styles.categoryImage}
                      onError={(e) => console.log(`Image load error for ${category.image_url}:`, e.nativeEvent.error)}
                    />
                  </View>
                  <Text style={styles.categoryName}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Popular Recipes */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Recipes</Text>
              <TouchableOpacity onPress={() => router.push('/order-now')}>
                <Text style={styles.seeMoreText}>See More</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipesScroll}>
              {popularRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onPress={() =>
                    router.push({
                      pathname: '/recipe-details',
                      params: { id: recipe.id, name: recipe.name, description: recipe.description, price: recipe.price, image_url: recipe.image_url },
                    })
                  }
                  onLikeToggle={() => toggleLike(recipe)}
                  isLiked={likedRecipes.includes(recipe.id)}
                />
              ))}
            </ScrollView>

            {/* More Recipes */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>More Recipes</Text>
              <TouchableOpacity onPress={() => router.push('/order-now')}>
                <Text style={styles.seeMoreText}>See More</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.recipeList}>
              {moreRecipes.length > 0 ? (
                moreRecipes.map((recipe) => (
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
                    onLikeToggle={() => toggleLike(recipe)}
                    isLiked={likedRecipes.includes(recipe.id)}
                  />
                ))
              ) : (
                <Text style={styles.noRecipesText}>No more recipes available</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/')}>
          <Feather name="home" size={24} color="#ff5722" />
          <Text style={styles.navTextActive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/search')}>
          <Feather name="search" size={24} color="#999" />
          <Text style={styles.navText}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/cart')}>
          <View style={styles.navIconContainer}>
            <Feather name="shopping-cart" size={24} color="#999" />
            {cartCount > 0 && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{cartCount}</Text>
              </View>
            )}
          </View>
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
    paddingBottom: 15,
    backgroundColor: '#ffffff',
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
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginLeft: 5,
  },
  notificationButton: {
    position: 'relative',
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#f8f8f8',
  },
  searchTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 55,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  searchIcon: {
    marginLeft: 10,
  },
  suggestionsContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 5,
  },
  promoBanner: {
    backgroundColor: '#ff5722',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    height: 180,
    shadowColor: '#ff5722',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 30,
  },
  promoTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  promoTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 5,
    lineHeight: 30,
  },
  promoSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 15,
  },
  orderNowButton: {
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  orderNowButtonText: {
    color: '#ff5722',
    fontSize: 16,
    fontWeight: '700',
  },
  promoBurgerImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    position: 'absolute',
    right: -20,
    bottom: -10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  seeMoreText: {
    color: '#ff5722',
    fontSize: 16,
    fontWeight: '600',
  },
  categoriesScroll: {
    paddingLeft: 20,
    marginBottom: 30,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  categoryImageWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    resizeMode: 'cover',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  recipesScroll: {
    paddingLeft: 20,
    marginBottom: 20,
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
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartIconFilled: {
    // Additional styles for filled heart can be added here if needed
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
  navItem: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  navText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontWeight: '600',
  },
  navTextActive: {
    fontSize: 12,
    color: '#ff5722',
    marginTop: 4,
    fontWeight: '700',
  },
  navIconContainer: {
    position: 'relative',
  },
  navBadge: {
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
  navBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  },
});