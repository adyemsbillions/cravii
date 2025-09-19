import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import Toast from 'react-native-root-toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const API_URL = 'https://cravii.ng';
const IMAGE_BASE_URL = 'https://cravii.ng/cravii/api/uploads/';
const PLACEHOLDER_RECIPE = require('../assets/images/recipe_chicken.jpg');

interface Restaurant {
  id: string;
  name: string;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  price: string;
  image_url: string;
  restaurantId: number;
  vat_fee?: string;
  delivery_fee?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

const fetchWithRetry = async (url: string, options: RequestInit, retries: number = 4, delay: number = 3000): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText || 'Unknown error'}`);
      }
      return response;
    } catch (error) {
      console.error(`Fetch attempt ${i + 1} failed for ${url}:`, error);
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Fetch failed after retries');
};

const Rest: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await fetchWithRetry(`${API_URL}/cravii/api/get_search_res.php`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        const text = await response.text();
        let result: ApiResponse<Restaurant[]>;
        try {
          result = JSON.parse(text);
        } catch (parseError) {
          console.error('JSON Parse error for restaurants:', parseError, 'Response:', text);
          throw new Error('Invalid JSON response from server');
        }
        if (result.success) {
          console.log('Fetched restaurants:', result.data);
          setRestaurants(result.data);
        } else {
          console.warn('Failed to fetch restaurants:', result.message);
          Toast.show(`Failed to fetch restaurants: ${result.message || 'Unknown error'}`, {
            duration: Toast.durations.LONG,
            position: Toast.positions.BOTTOM,
            backgroundColor: '#d32f2f',
          });
        }
      } catch (error) {
        console.error('Error fetching restaurants:', error);
        Toast.show('Unable to load restaurants. Please check your connection and try again.', {
          duration: Toast.durations.LONG,
          position: Toast.positions.BOTTOM,
          backgroundColor: '#d32f2f',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      const fetchRecipes = async () => {
        setIsLoading(true);
        try {
          const response = await fetchWithRetry(`${API_URL}/cravii/api/get_search_rec.php`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          const text = await response.text();
          let result: ApiResponse<Recipe[]>;
          try {
            result = JSON.parse(text);
          } catch (parseError) {
            console.error('JSON Parse error for recipes:', parseError, 'Response:', text);
            throw new Error('Invalid JSON response from server');
          }
          if (result.success) {
            const filteredRecipes = result.data.filter(recipe => parseInt(recipe.restaurantId) === parseInt(selectedRestaurant.id));
            console.log('Fetched recipes for restaurant:', selectedRestaurant.name, filteredRecipes);
            setRecipes(filteredRecipes);
          } else {
            console.warn('Failed to fetch recipes:', result.message);
            Toast.show(`Failed to fetch recipes: ${result.message || 'Unknown error'}`, {
              duration: Toast.durations.LONG,
              position: Toast.positions.BOTTOM,
              backgroundColor: '#d32f2f',
            });
          }
        } catch (error) {
          console.error('Error fetching recipes:', error);
          Toast.show('Unable to load recipes. Please check your connection and try again.', {
            duration: Toast.durations.LONG,
            position: Toast.positions.BOTTOM,
            backgroundColor: '#d32f2f',
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchRecipes();
    }
  }, [selectedRestaurant]);

  // Filter restaurants or recipes based on search query
  const filteredItems = selectedRestaurant
    ? recipes.filter(recipe => recipe.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : restaurants.filter(restaurant => restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollViewContent}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.userInfo}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push('/search')}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Restaurants</Text>
          </View>
        </View>

        {/* Search Input */}
        <View style={styles.searchSection}>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search restaurants or recipes..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              accessibilityLabel="Search restaurants or recipes"
            />
          </View>
        </View>

        {/* Restaurant List or Recipe Details */}
        {selectedRestaurant ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{selectedRestaurant.name} Recipes</Text>
            </View>
            <View style={styles.recipeList}>
              {filteredItems.length > 0 ? (
                filteredItems.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.recipeCard}
                    onPress={() => router.push(`/recipe-details?id=${recipe.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${recipe.name} details`}
                  >
                    <Image
                      source={{ uri: `${IMAGE_BASE_URL}${recipe.image_url}` }}
                      style={styles.recipeImage}
                      defaultSource={PLACEHOLDER_RECIPE}
                      onError={(e) => console.log(`Image load error for ${recipe.image_url}:`, e.nativeEvent.error)}
                    />
                    <View style={styles.recipeInfo}>
                      <Text style={styles.recipeName}>{recipe.name}</Text>
                      <Text style={styles.recipeDescription} numberOfLines={2} ellipsizeMode="tail">
                        {recipe.description}
                      </Text>
                      <Text style={styles.recipePrice}>₦{recipe.price}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noRecipesText}>No recipes found for {selectedRestaurant.name}</Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.restaurantList}>
            {filteredItems.length > 0 ? (
              filteredItems.map((restaurant) => (
                <TouchableOpacity
                  key={restaurant.id}
                  style={styles.restaurantItem}
                  onPress={() => setSelectedRestaurant(restaurant)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${restaurant.name} recipes`}
                >
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  <Feather name="chevron-right" size={20} color="#666" />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noRestaurantsText}>No restaurants found</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollViewContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f8f8',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 50,
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
    paddingVertical: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  restaurantList: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  restaurantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  noRestaurantsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  recipeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
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
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  recipeInfo: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 5,
  },
  recipeDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  recipePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4ade80',
    textAlign: 'right',
  },
  noRecipesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    width: '100%',
  },
});

export default Rest;