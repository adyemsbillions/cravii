import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

// Reusing interfaces from Dashboard.tsx
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

// Reusable RecipeCard component (adjusted for smaller size and like functionality)
const RecipeCard = memo(
  ({
    recipe,
    onPress,
    onLikeToggle,
    isLiked,
  }: {
    recipe: Recipe;
    onPress: () => void;
    onLikeToggle: () => void;
    isLiked: boolean;
  }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${recipe.name} details`}
    >
      <Image
        source={
          recipe.image_url
            ? { uri: `https://cravii.ng/cravii/api/${recipe.image_url}` }
            : require('../assets/images/promo_burger.png')
        }
        style={styles.recipeImage}
        onError={(e) => console.log(`Image load error for ${recipe.image_url}:`, e.nativeEvent.error)}
      />
      <View style={styles.recipeInfo}>
        <Text style={styles.recipeName}>{recipe.name}</Text>
        <Text
          style={styles.recipeDescription}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {recipe.description}
        </Text>
        <View style={styles.recipeFooter}>
          <Text style={styles.recipePrice}>{`₦${recipe.price || '0.00'}`}</Text>
          <TouchableOpacity style={styles.heartIcon} onPress={onLikeToggle}>
            <Feather
              name="heart"
              size={16}
              color={isLiked ? '#ff5722' : '#999'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
);

const { width } = Dimensions.get('window');

export default function SearchResults() {
  const insets = useSafeAreaInsets();
  const { query } = useLocalSearchParams();
  const router = useRouter();
  const [searchRecipes, setSearchRecipes] = useState<Recipe[]>([]);
  const [exploreRecipes, setExploreRecipes] = useState<Recipe[]>([]);
  const [likedRecipes, setLikedRecipes] = useState<string[]>([]);

  // Fetch liked recipes on mount
  useEffect(() => {
    const fetchLikes = async () => {
      try {
        const likes = await AsyncStorage.getItem('likes');
        const likedItems: Recipe[] = likes ? JSON.parse(likes) : [];
        setLikedRecipes(likedItems.map((item) => item.id));
      } catch (error) {
        console.error('Error fetching liked recipes:', error);
      }
    };
    fetchLikes();
  }, []);

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

  // Fetch recipes
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const response = await fetch('https://cravii.ng/cravii/api/get_recipes.php', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const result: ApiResponse<Recipe[]> = await response.json();
        if (result.success) {
          const allRecipes = result.data || [];
          // Filter search results
          const filteredRecipes = allRecipes.filter((recipe) =>
            recipe.name.toLowerCase().includes((query as string)?.toLowerCase() || '')
          );
          setSearchRecipes(filteredRecipes);
          // Select up to 10 random recipes for explore (excluding search results)
          const availableRecipes = allRecipes.filter(
            (recipe) => !filteredRecipes.some((r) => r.id === recipe.id)
          );
          const shuffled = [...availableRecipes].sort(() => Math.random() - 0.5);
          setExploreRecipes(shuffled.slice(0, 10));
        } else {
          console.error('Failed to fetch recipes:', result.message);
          setSearchRecipes([]);
          setExploreRecipes([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setSearchRecipes([]);
        setExploreRecipes([]);
      }
    };
    fetchRecipes();
  }, [query]);

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarPlaceholder, { height: insets.top, backgroundColor: '#ffffff' }]} />
      <ScrollView
        style={styles.scrollViewContent}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerText}>Search Results for "{query}"</Text>
        </View>
        {searchRecipes.length > 0 ? (
          <View style={styles.recipeList}>
            {searchRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() =>
                  router.push({
                    pathname: '/recipe-details',
                    params: {
                      id: recipe.id,
                      name: recipe.name,
                      description: recipe.description,
                      price: recipe.price,
                      image_url: recipe.image_url,
                    },
                  })
                }
                onLikeToggle={() => toggleLike(recipe)}
                isLiked={likedRecipes.includes(recipe.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.noResultsText}>No recipes found.</Text>
        )}
        {exploreRecipes.length > 0 && (
          <View>
            <Text style={styles.exploreText}>Explore</Text>
            <View style={styles.recipeList}>
              {exploreRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onPress={() =>
                    router.push({
                      pathname: '/recipe-details',
                      params: {
                        id: recipe.id,
                        name: recipe.name,
                        description: recipe.description,
                        price: recipe.price,
                        image_url: recipe.image_url,
                      },
                    })
                  }
                  onLikeToggle={() => toggleLike(recipe)}
                  isLiked={likedRecipes.includes(recipe.id)}
                />
              ))}
            </View>
          </View>
        )}
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
    paddingHorizontal: 20,
    paddingTop: 20,
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
  headerText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
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
    borderRadius: 15,
    width: (width - 50) / 3, // Match likes.tsx size
    marginHorizontal: 5,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: 80, // Match likes.tsx
    resizeMode: 'cover',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  recipeInfo: {
    padding: 8, // Match likes.tsx
  },
  recipeName: {
    fontSize: 14, // Match likes.tsx
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  recipeDescription: {
    fontSize: 10, // Match likes.tsx
    color: '#666',
    marginBottom: 5,
  },
  recipeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipePrice: {
    fontSize: 14, // Match likes.tsx
    fontWeight: '800',
    color: '#e63946',
  },
  heartIcon: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12, // Match likes.tsx
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  exploreText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff5722',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
});