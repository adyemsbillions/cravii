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
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]); // Re-run animation on step change

  const handleSendCode = async () => {
    if (!email || !filterEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('https://cravii.ng/cravii/api/forgot_password.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'send_code' }),
      });
      const result = await response.json();
      if (result.success) {
        setStep('reset_password');
        alert('A reset code has been sent to your email!');
      } else {
        setError(result.message || 'Failed to send reset code');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Error sending code:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code || !newPassword || !confirmNewPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('https://cravii.ng/cravii/api/forgot_password.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code,
          new_password: newPassword,
          action: 'reset_password',
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert('Your password has been reset successfully!');
        router.replace('/login');
      } else {
        setError(result.message || 'Failed to reset password');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Error resetting password:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Email validation function
  const filterEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ImageBackground
        source={require('../assets/images/background.jpg')}
        style={styles.container}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)']}
          style={styles.overlay}
        >
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
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
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Reset Your Password</Text>
                  <Text style={styles.cardSubtitle}>
                    Enter your email to receive a verification code.
                  </Text>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <View style={styles.inputGroup}>
                    <Feather name="mail" size={22} color="#888" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor="#aaa"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      editable={!isLoading}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.disabledButton]}
                    onPress={handleSendCode}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isLoading ? 'Sending...' : 'Send Code'}
                    </Text>
                    {!isLoading && (
                      <Feather name="send" size={22} color="#fff" style={styles.buttonIcon} />
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Set New Password</Text>
                  <Text style={styles.cardSubtitle}>
                    Enter the code sent to {email} and your new password.
                  </Text>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <View style={styles.inputGroup}>
                    <Feather name="hash" size={22} color="#888" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Verification Code"
                      placeholderTextColor="#aaa"
                      keyboardType="numeric"
                      value={code}
                      onChangeText={setCode}
                      editable={!isLoading}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Feather name="lock" size={22} color="#888" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="New Password"
                      placeholderTextColor="#aaa"
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                      editable={!isLoading}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Feather name="lock" size={22} color="#888" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm New Password"
                      placeholderTextColor="#aaa"
                      secureTextEntry
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      editable={!isLoading}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.disabledButton]}
                    onPress={handleResetPassword}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isLoading ? 'Resetting...' : 'Reset Password'}
                    </Text>
                    {!isLoading && (
                      <Feather name="check-circle" size={22} color="#fff" style={styles.buttonIcon} />
                    )}
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.bottomSection}>
                <TouchableOpacity
                  style={styles.backToLoginButton}
                  onPress={() => router.push('/login')}
                  disabled={isLoading}
                >
                  <Text style={styles.backToLoginText}>
                    Back to <Text style={styles.backToLoginLink}>Login</Text>
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
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', // Fallback for gradient
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 25,
    padding: 30,
    marginHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    maxWidth: '90%',
  },
  errorText: {
    fontSize: 14,
    color: '#e63946',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '500',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 15,
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#ff5722',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    width: '100%',
    shadowColor: '#ff5722',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#ff8a65',
    shadowOpacity: 0.1,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
  },
  buttonIcon: {
    marginLeft: 5,
  },
  bottomSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  backToLoginButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
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