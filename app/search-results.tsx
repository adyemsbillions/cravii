import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

// Reusable RecipeCard component (adjusted for full image)
const RecipeCard = ({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) => (
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
    <TouchableOpacity style={styles.heartIcon}>
      <Feather name="heart" size={18} color="#ff5722" />
    </TouchableOpacity>
    <View style={styles.recipeInfo}>
      <Text style={styles.recipeName}>{recipe.name}</Text>
      <Text style={styles.recipeDescription}>{recipe.description}</Text>
      <View style={styles.recipeFooter}>
        <Text style={styles.recipePrice}>{`₦${recipe.price || '0.00'}`}</Text>
        <TouchableOpacity style={styles.addIcon}>
          <Feather name="plus" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  </TouchableOpacity>
);

const { width } = Dimensions.get('window');

export default function SearchResults() {
  const insets = useSafeAreaInsets();
  const { query } = useLocalSearchParams();
  const router = useRouter();
  const [searchRecipes, setSearchRecipes] = useState<Recipe[]>([]);
  const [exploreRecipes, setExploreRecipes] = useState<Recipe[]>([]);

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
    paddingHorizontal: 10,
    paddingBottom: 30,
    alignItems: 'center',
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: width * 0.85,
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
    height: 200, // Increased height to fill the card
    resizeMode: 'cover',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  heartIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeInfo: {
    padding: 15,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 5,
  },
  recipeDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
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
  addIcon: {
    backgroundColor: '#ff5722',
    borderRadius: 15,
    width: 30,
    height: 30,
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