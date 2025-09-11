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

// Reusable RecipeCard component
const RecipeCard = memo(
  ({
    recipe,
    onPress,
    onUnlike,
  }: {
    recipe: Recipe;
    onPress: () => void;
    onUnlike: () => void;
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
            : PLACEHOLDER_RECIPE
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
          <Text style={styles.recipePrice}>
            {`₦${recipe.price || '0.00'}`}
          </Text>
          <TouchableOpacity style={styles.heartIcon} onPress={onUnlike}>
            <Feather name="heart" size={16} color="#ff5722" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
);

export default function Likes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [likedRecipes, setLikedRecipes] = useState<Recipe[]>([]);

  // Fetch liked recipes on mount
  useEffect(() => {
    const fetchLikes = async () => {
      try {
        const likes = await AsyncStorage.getItem('likes');
        const likedItems = likes ? JSON.parse(likes) : [];
        setLikedRecipes(likedItems);
      } catch (error) {
        console.error('Error fetching liked recipes:', error);
      }
    };
    fetchLikes();
  }, []);

  // Function to unlike a recipe
  const unlikeRecipe = async (recipeId: string) => {
    try {
      const likes = await AsyncStorage.getItem('likes');
      let likedItems: Recipe[] = likes ? JSON.parse(likes) : [];
      likedItems = likedItems.filter((item) => item.id !== recipeId);
      await AsyncStorage.setItem('likes', JSON.stringify(likedItems));
      setLikedRecipes(likedItems);
      console.log('Removed from likes:', recipeId);
    } catch (error) {
      console.error('Error unliking recipe:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#ff5722" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liked Recipes</Text>
      </View>
      <ScrollView
        style={styles.scrollViewContent}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.recipeList}>
          {likedRecipes.length > 0 ? (
            likedRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() =>
                  router.push({
                    pathname: '/recipe-details',
                    params: { id: recipe.id, name: recipe.name, description: recipe.description, price: recipe.price, image_url: recipe.image_url },
                  })
                }
                onUnlike={() => unlikeRecipe(recipe.id)}
              />
            ))
          ) : (
            <Text style={styles.noRecipesText}>No liked recipes yet</Text>
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
  header: {
    flexDirection: 'row',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginLeft: 20,
  },
  scrollViewContent: {
    flex: 1,
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
    width: (width - 50) / 3, // Smaller cards
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
    height: 80, // Reduced height
    resizeMode: 'cover',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  recipeInfo: {
    padding: 8,
  },
  recipeName: {
    fontSize: 14, // Smaller font
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  recipeDescription: {
    fontSize: 10, // Smaller font
    color: '#666',
    marginBottom: 5,
  },
  recipeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipePrice: {
    fontSize: 14, // Smaller font
    fontWeight: '800',
    color: '#e63946',
  },
  heartIcon: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noRecipesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    width: '100%',
  },
});