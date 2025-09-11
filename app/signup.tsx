import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [focusedInput, setFocusedInput] = useState<string>('');
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  
  // Success modal animations
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.3)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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

  const showSuccessAnimation = () => {
    setShowSuccessModal(true);
    
    // Reset animations
    modalOpacity.setValue(0);
    modalScale.setValue(0.3);
    checkmarkScale.setValue(0);
    confettiAnim.setValue(0);

    // Animate modal entrance
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(modalScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Animate checkmark
      Animated.spring(checkmarkScale, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }).start();

      // Animate confetti
      Animated.timing(confettiAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    });
  };

  const hideSuccessModal = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalScale, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSuccessModal(false);
      router.push('/login');
    });
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Vibration.vibrate(100);
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Vibration.vibrate([100, 50, 100]);
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Vibration.vibrate(100);
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    animateButton();
    setIsLoading(true);

    try {
      const response = await fetch('https://cravii.ng/cravii/api/signup.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          confirmPassword,
        }),
      });

      const contentType = response.headers.get('content-type');
      const text = await response.text();

      if (!contentType || !contentType.includes('application/json')) {
        Alert.alert('Error', 'Server returned an invalid response. Please try again later.');
        return;
      }

      const data = JSON.parse(text);
      if (response.ok) {
        // Show success animation instead of alert
        showSuccessAnimation();
        Vibration.vibrate([100, 50, 100, 50, 200]); // Success vibration pattern
      } else {
        Alert.alert('Error', data.error || 'Failed to register');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Network error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInputField = (
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    iconName: keyof typeof Feather.glyphMap,
    secureTextEntry = false,
    showPasswordToggle = false,
    showPassword = false,
    onTogglePassword?: () => void
  ) => {
    const isFocused = focusedInput === placeholder;
    
    return (
      <Animated.View
        style={[
          styles.inputGroup,
          isFocused && styles.inputGroupFocused,
          { transform: [{ scale: isFocused ? 1.02 : 1 }] }
        ]}
      >
        <Feather 
          name={iconName} 
          size={20} 
          color={isFocused ? '#FF6B35' : '#8E8E93'} 
          style={styles.inputIcon} 
        />
        <TextInput
          style={[styles.input, isFocused && styles.inputFocused]}
          placeholder={placeholder}
          placeholderTextColor="#C7C7CC"
          keyboardType={placeholder === 'Email' ? 'email-address' : 'default'}
          autoCapitalize="none"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          onFocus={() => setFocusedInput(placeholder)}
          onBlur={() => setFocusedInput('')}
        />
        {showPasswordToggle && (
          <TouchableOpacity onPress={onTogglePassword} style={styles.eyeIcon}>
            <Feather 
              name={showPassword ? 'eye-off' : 'eye'} 
              size={20} 
              color={isFocused ? '#FF6B35' : '#8E8E93'} 
            />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  const renderConfettiParticle = (index: number) => {
    const colors = ['#FF6B35', '#F7931E', '#FFD700', '#FF69B4', '#00CED1'];
    const randomColor = colors[index % colors.length];
    const randomDelay = Math.random() * 500;
    const randomDuration = 1000 + Math.random() * 1000;
    
    const translateY = confettiAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-50, height * 0.8],
    });

    const rotate = confettiAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '720deg'],
    });

    return (
      <Animated.View
        key={index}
        style={[
          styles.confettiParticle,
          {
            backgroundColor: randomColor,
            left: Math.random() * width,
            transform: [
              { translateY },
              { rotate },
            ],
          },
        ]}
      />
    );
  };

  const SuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        {/* Confetti Animation */}
        {Array.from({ length: 20 }, (_, i) => renderConfettiParticle(i))}
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FF6B35', '#F7931E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalGradient}
          >
            {/* Success Icon */}
            <Animated.View
              style={[
                styles.successIconContainer,
                { transform: [{ scale: checkmarkScale }] },
              ]}
            >
              <View style={styles.successIcon}>
                <Feather name="check" size={40} color="#fff" />
              </View>
            </Animated.View>

            {/* Success Content */}
            <View style={styles.successContent}>
              <Text style={styles.successTitle}>Welcome to Cravii! 🎉</Text>
              <Text style={styles.successMessage}>
                Your account has been created successfully!{'\n'}
                Get ready to explore amazing culinary experiences.
              </Text>
              
              <View style={styles.successFeatures}>
                <View style={styles.featureItem}>
                  <Feather name="star" size={16} color="#FFD700" />
                  <Text style={styles.featureText}>Discover new recipes</Text>
                </View>
                <View style={styles.featureItem}>
                  <Feather name="users" size={16} color="#FFD700" />
                  <Text style={styles.featureText}>Connect with food lovers</Text>
                </View>
                <View style={styles.featureItem}>
                  <Feather name="bookmark" size={16} color="#FFD700" />
                  <Text style={styles.featureText}>Save your favorites</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={hideSuccessModal}
                activeOpacity={0.8}
              >
                <Text style={styles.continueButtonText}>Continue to Login</Text>
                <Feather name="arrow-right" size={20} color="#FF6B35" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ImageBackground
        source={require('../assets/images/background.jpg')}
        style={styles.container}
        resizeMode="cover"
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
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View
                style={[
                  styles.content,
                  {
                    opacity: fadeAnim,
                    transform: [
                      { translateY: slideAnim },
                      { scale: scaleAnim }
                    ],
                  },
                ]}
              >
                {/* Header Section */}
                {/* <View style={styles.headerSection}>
                  <Text style={styles.welcomeText}>Welcome to</Text>
                  <LinearGradient
                    colors={['#FF6B35', '#F7931E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.brandGradient}
                  >
                    <Text style={styles.brandText}>Cravii</Text>
                  </LinearGradient>
                  <Text style={styles.taglineText}>Satisfy Your Cravings Instantly</Text>
                </View> */}

                {/* Main Card */}
                <Animated.View 
                  style={[
                    styles.signupCard,
                    { transform: [{ scale: cardScale }] }
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Create Account</Text>
                    <Text style={styles.cardSubtitle}>Join thousands of food lovers</Text>
                  </View>

                  <View style={styles.formSection}>
                    {renderInputField(
                      'Email',
                      email,
                      setEmail,
                      'mail'
                    )}

                    {renderInputField(
                      'Password',
                      password,
                      setPassword,
                      'lock',
                      true,
                      true,
                      showPassword,
                      () => setShowPassword(!showPassword)
                    )}

                    {renderInputField(
                      'Confirm Password',
                      confirmPassword,
                      setConfirmPassword,
                      'shield',
                      true,
                      true,
                      showConfirmPassword,
                      () => setShowConfirmPassword(!showConfirmPassword)
                    )}

                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                      <TouchableOpacity
                        style={[styles.primaryButton, isLoading && styles.primaryButtonLoading]}
                        onPress={handleSignUp}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={isLoading ? ['#CCCCCC', '#999999'] : ['#FF6B35', '#F7931E']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.buttonGradient}
                        >
                          {isLoading ? (
                            <View style={styles.loadingContainer}>
                              <Text style={styles.primaryButtonText}>Creating Account...</Text>
                            </View>
                          ) : (
                            <>
                              <Text style={styles.primaryButtonText}>Create Account</Text>
                              <Feather name="arrow-right" size={20} color="#fff" />
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>

                  {/* Social Login Section */}
                  <View style={styles.socialSection}>
                    <View style={styles.dividerContainer}>
                      <View style={styles.divider} />
                      <Text style={styles.orText}>Satisfy Your Cravings</Text>
                      <View style={styles.divider} />
                    </View>

                    {/* <View style={styles.socialGrid}>
                      {[
                        { name: 'Google', icon: 'chrome', color: '#DB4437' },
                        { name: 'Facebook', icon: 'facebook', color: '#4267B2' },
                        { name: 'Apple', icon: 'smartphone', color: '#000000' },
                      ].map((social, index) => (
                        <TouchableOpacity key={index} style={styles.socialButton}>
                          <View style={[styles.socialIconContainer, { backgroundColor: `${social.color}15` }]}>
                            <Feather name={social.icon as keyof typeof Feather.glyphMap} size={24} color={social.color} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View> */}
                  </View>
                </Animated.View>

                {/* Bottom Section */}
                <View style={styles.bottomSection}>
                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={() => router.push('/login')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.loginText}>
                      Already have an account?{' '}
                      <Text style={styles.loginLink}>Sign In</Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </LinearGradient>
      </ImageBackground>

      {/* Success Modal */}
      <SuccessModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '300',
    letterSpacing: 1,
  },
  brandGradient: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 25,
    marginVertical: 8,
  },
  brandText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  taglineText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 5,
  },
  signupCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 30,
    padding: 30,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 15,
    backdropFilter: 'blur(10px)',
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
    marginBottom: 25,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputGroupFocused: {
    backgroundColor: '#fff',
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF6B35',
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialSection: {
    marginTop: 20,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  orText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 16,
  },
  socialGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  socialButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  bottomSection: {
    alignItems: 'center',
    marginTop: 30,
  },
  loginButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  loginText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  loginLink: {
    color: '#FF6B35',
    fontWeight: '600',
  },

  // Success Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalGradient: {
    padding: 40,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 30,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  successContent: {
    alignItems: 'center',
    marginBottom: 30,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
  },
  successMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 25,
  },
  successFeatures: {
    alignItems: 'flex-start',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 10,
    fontWeight: '500',
  },
  modalActions: {
    width: '100%',
  },
  continueButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: '#FF6B35',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  confettiParticle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});