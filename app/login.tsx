import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkSession();
    startAnimations();
  }, []);

  const checkSession = async () => {
    try {
      const userId = await AsyncStorage.getItem('id');
      if (userId) {
        console.log('Session found, redirecting to restaurant:', userId);
        router.replace('/restaurant');
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLogin = async () => {
    // Reset errors
    setEmailError('');
    setPasswordError('');

    // Validation
    if (!email) {
      setEmailError('Email is required');
      Vibration.vibrate(100);
      return;
    }
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      Vibration.vibrate(100);
      return;
    }
    if (!password) {
      setPasswordError('Password is required');
      Vibration.vibrate(100);
      return;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      Vibration.vibrate(100);
      return;
    }

    animateButton();
    setIsLoading(true);

    try {
      const response = await fetch('https://cravii.ng/cravii/api/login.php', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        }),
      });

      const contentType = response.headers.get('content-type');
      const text = await response.text();
      console.log('Raw response:', text);

      if (!contentType || !contentType.includes('application/json')) {
        Alert.alert('Error', 'Server returned an invalid response. Please try again later.');
        console.error('Invalid content type:', contentType);
        return;
      }

      const data = JSON.parse(text);

      if (response.ok && data.user?.id) {
        // Store multiple user data
        await AsyncStorage.multiSet([
          ['id', data.user.id.toString()],
          ['email', email],
          ['loginTime', new Date().toISOString()]
        ]);
        
        console.log('Stored ID:', data.user.id);
        Vibration.vibrate([100, 50, 100]); // Success vibration
        
        // Success animation before navigation
        Animated.sequence([
          Animated.timing(buttonScale, {
            toValue: 1.1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(buttonScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          router.replace('/restaurant');
        });
      } else {
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
        Vibration.vibrate([100, 50, 100]);
      }
    } catch (error: any) {
      Alert.alert('Connection Error', 'Please check your internet connection and try again.');
      console.error('Network error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      Vibration.vibrate(200);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['id', 'email', 'loginTime']);
      console.log('Session cleared');
      Alert.alert('Success', 'Logged out successfully');
      router.replace('/login');
    } catch (error) {
      console.error('Error clearing session:', error);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  const renderInputField = (
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    iconName: keyof typeof Feather.glyphMap,
    secureTextEntry = false,
    showPasswordToggle = false,
    error?: string
  ) => {
    const isFocused = focusedInput === placeholder;

    return (
      <View style={styles.inputContainer}>
        <Animated.View
          style={[
            styles.inputGroup,
            isFocused && styles.inputGroupFocused,
            error && styles.inputGroupError,
            { transform: [{ scale: isFocused ? 1.02 : 1 }] }
          ]}
        >
          <Feather 
            name={iconName} 
            size={20} 
            color={error ? '#ff4444' : isFocused ? '#ff5722' : '#666'} 
            style={styles.inputIcon} 
          />
          <TextInput
            style={[styles.input, isFocused && styles.inputFocused]}
            placeholder={placeholder}
            placeholderTextColor="#999"
            keyboardType={placeholder === 'Email' ? 'email-address' : 'default'}
            autoCapitalize="none"
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry && !showPassword}
            onFocus={() => setFocusedInput(placeholder)}
            onBlur={() => {
              setFocusedInput('');
              // Validate on blur
              if (placeholder === 'Email' && value) {
                if (!validateEmail(value)) {
                  setEmailError('Please enter a valid email address');
                } else {
                  setEmailError('');
                }
              }
            }}
          />
          {showPasswordToggle && (
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)} 
              style={styles.eyeIcon}
            >
              <Feather 
                name={showPassword ? 'eye-off' : 'eye'} 
                size={20} 
                color={isFocused ? '#ff5722' : '#666'} 
              />
            </TouchableOpacity>
          )}
        </Animated.View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ImageBackground
        source={require('../assets/images/background.jpg')}
        style={styles.container}
        resizeMode="cover"
        imageStyle={styles.imageStyle}
      >
        <LinearGradient
          colors={['rgba(255,107,53,0.1)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
          locations={[0, 0.6, 1]}
          style={styles.overlay}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                },
              ]}
            >
              {/* Brand Header
              <View style={styles.brandSection}>
                <LinearGradient
                  colors={['#ff5722', '#ff8a50']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.brandGradient}
                >
                  <Text style={styles.brandText}>Cravi</Text>
                </LinearGradient>
                <Text style={styles.welcomeText}>Welcome back to your culinary journey</Text>
              </View> */}

              {/* Login Card */}
              <View style={styles.loginCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Welcome Back!</Text>
                  <Text style={styles.cardSubtitle}>Sign in to continue</Text>
                </View>

                <View style={styles.formSection}>
                  {renderInputField('Email', email, setEmail, 'mail', false, false, emailError)}
                  {renderInputField('Password', password, setPassword, 'lock', true, true, passwordError)}

                  <TouchableOpacity
                    style={styles.forgotPasswordButton}
                    onPress={() => router.push('/forgot-password')}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                    <TouchableOpacity
                      style={[styles.primaryButton, isLoading && styles.primaryButtonLoading]}
                      onPress={handleLogin}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={isLoading ? ['#CCCCCC', '#999999'] : ['#ff5722', '#ff8a50']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        <Text style={styles.primaryButtonText}>
                          {isLoading ? 'Signing In...' : 'Login'}
                        </Text>
                        <Feather name="log-in" size={20} color="#fff" style={styles.buttonIcon} />
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>

              {/* Social Login Grid */}
              <View style={styles.socialSection}>
                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.orText}>Or continue with</Text>
                  <View style={styles.divider} />
                </View>
                
                <View style={styles.socialGrid}>
                  {[
                    { name: 'Facebook', icon: 'facebook', color: '#3b5998' },
                    { name: 'Google', icon: 'chrome', color: '#db4437' },
                    { name: 'Apple', icon: 'smartphone', color: '#000000' },
                  ].map((social, index) => (
                    <TouchableOpacity key={index} style={styles.socialCard} activeOpacity={0.8}>
                      <View style={[styles.socialIconContainer, { backgroundColor: `${social.color}15` }]}>
                        <Feather name={social.icon as keyof typeof Feather.glyphMap} size={24} color={social.color} />
                      </View>
                      <Text style={styles.socialText}>{social.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Bottom CTA */}
              <View style={styles.bottomSection}>
                <TouchableOpacity
                  style={styles.signupButton}
                  onPress={() => router.push('/signup')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.signupText}>
                    Don't have an account?{' '}
                    <Text style={styles.signupLink}>Sign Up</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </LinearGradient>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageStyle: {
    resizeMode: 'cover',
    top: 0,
  },
  overlay: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandGradient: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 25,
    marginBottom: 10,
  },
  brandText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontWeight: '400',
  },
  loginCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 30,
    padding: 30,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 15,
    marginBottom: 30,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    fontWeight: '400',
  },
  formSection: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 15,
    width: '100%',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputGroupFocused: {
    backgroundColor: '#fff',
    borderColor: '#ff5722',
    shadowColor: '#ff5722',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputGroupError: {
    borderColor: '#ff4444',
    backgroundColor: '#fff',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '400',
  },
  inputFocused: {
    color: '#1C1C1E',
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
    fontWeight: '500',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: '#ff5722',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ff5722',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonLoading: {
    shadowOpacity: 0.1,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 5,
  },
  socialSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    width: '100%',
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  orText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 16,
  },
  socialGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 10,
  },
  socialCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: (width - 80) / 3,
    height: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  socialIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  socialText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomSection: {
    alignItems: 'center',
  },
  signupButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  signupText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  signupLink: {
    color: '#ff5722',
    fontWeight: '700',
  },
});