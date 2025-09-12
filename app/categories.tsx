import { Feather } from '@expo/vector-icons';
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

const { width } = Dimensions.get('window');

// Placeholder image
const PLACEHOLDER_RECIPE = require('../assets/images/promo_burger.png');

// Interface for TypeScript
interface Recipe {
  id: string;
  name: string;
  description: string;
  price: string;
  image_url: string | null;
  category_id: string | number;
  restaurantId: number | null;
  vat_fee: string;
  delivery_fee: string;
  created_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Reusable RecipeCard component
const RecipeCard = memo(
  ({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${recipe.name} details`}
    >
      <Image
        source={
          recipe.image_url
            ? { uri: `https://cravii.ng/cravii/api/uploads/${recipe.image_url}` }
            : PLACEHOLDER_RECIPE
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
  )
);

export default function Categories() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch recipes for the selected category
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`https://cravii.ng/cravii/api/fetch_recipes_by_category.php?category_id=${id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const result: ApiResponse<Recipe[]> = await response.json();
        if (result.success) {
          console.log('Fetched Recipes for Category:', result.data);
          setRecipes(result.data || []);
        } else {
          setError(result.message || 'Failed to fetch recipes.');
          console.error('Failed to fetch recipes:', result.message);
          setRecipes([]);
        }
      } catch (error) {
        setError('Error fetching recipes: ' + (error instanceof Error ? error.message : 'Unknown error'));
        console.error('Error fetching category recipes:', error);
        setRecipes([]);
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchRecipes();
    } else {
      setError('Invalid category ID.');
      setLoading(false);
    }
  }, [id]);

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarPlaceholder, { height: insets.top, backgroundColor: '#ffffff' }]} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{name || 'Category'}</Text>
      </View>
      <ScrollView
        style={styles.scrollViewContent}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.recipeList}>
          {loading ? (
            <Text style={styles.loadingText}>Loading recipes...</Text>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : recipes.length > 0 ? (
            recipes.map((recipe) => (
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
                      image_url: recipe.image_url || '',
                    },
                  })
                }
              />
            ))
          ) : (
            <Text style={styles.noRecipesText}>No recipes available in this category</Text>
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  recipeList: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: Math.min(Math.max(width * 0.85, 300), 400),
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  recipeImage: {
    width: '100%',
    height: 150,
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
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e63946',
    textAlign: 'center',
    marginTop: 20,
  },
  noRecipesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
});