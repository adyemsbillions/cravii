import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState('request_code'); // 'request_code' or 'reset_password'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
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
  }, []);

  const handleSendCode = () => {
    // In a real app, you would send an API request here
    console.log('Sending password reset code to:', email);
    // Simulate success and move to next step
    setTimeout(() => {
      setStep('reset_password');
      alert('A reset code has been sent to your email!');
    }, 1000);
  };

  const handleResetPassword = () => {
    // In a real app, you would send an API request here with code and new password
    if (newPassword !== confirmNewPassword) {
      alert("New passwords don't match!");
      return;
    }
    console.log('Resetting password with code:', code, 'and new password:', newPassword);
    // Simulate success and navigate to login
    setTimeout(() => {
      alert('Your password has been reset successfully!');
      router.replace('/login'); // Go back to login screen
    }, 1000);
  };

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ImageBackground
        source={require('../assets/images/background.jpg')}
        style={styles.container}
        resizeMode="cover"
        imageStyle={styles.imageStyle}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']}
          style={styles.overlay}
        >
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              {step === 'request_code' ? (
                // Request Code Card
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Forgot Password?</Text>
                  <Text style={styles.cardSubtitle}>
                    Enter your email to receive a reset code.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Feather name="mail" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor="#999"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleSendCode}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryButtonText}>Send Code</Text>
                    <Feather name="send" size={20} color="#fff" style={styles.buttonIcon} />
                  </TouchableOpacity>
                </View>
              ) : (
                // Reset Password Card
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Reset Password</Text>
                  <Text style={styles.cardSubtitle}>
                    Enter the code sent to your email and your new password.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Feather name="hash" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Verification Code"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      value={code}
                      onChangeText={setCode}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="New Password"
                      placeholderTextColor="#999"
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm New Password"
                      placeholderTextColor="#999"
                      secureTextEntry
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleResetPassword}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryButtonText}>Reset Password</Text>
                    <Feather name="check-circle" size={20} color="#fff" style={styles.buttonIcon} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Bottom CTA */}
              <View style={styles.bottomSection}>
                <TouchableOpacity
                  style={styles.backToLoginButton}
                  onPress={() => router.push('/login')}
                >
                  <Text style={styles.backToLoginText}>
                    Remembered your password? <Text style={styles.backToLoginLink}>Login</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 60,
  },

  // Card (used for both steps)
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 25,
    padding: 30,
    marginHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 30,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    width: '100%',
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  primaryButton: {
    backgroundColor: '#ff5722',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: '100%',
    shadowColor: '#ff5722',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
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

  // Bottom Section
  bottomSection: {
    alignItems: 'center',
    marginTop: 20, // Added margin to separate from card
  },
  backToLoginButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  backToLoginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  backToLoginLink: {
    color: '#4ade80',
    fontWeight: '700',
  },
});