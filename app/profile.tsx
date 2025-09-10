    import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
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

    export default function Profile() {
      const insets = useSafeAreaInsets();
      const router = useRouter();

      // State for form data
      const [name, setName] = useState('');
      const [email, setEmail] = useState('');
      const [location, setLocation] = useState('');
      const [gender, setGender] = useState('');
      const [referralCode, setReferralCode] = useState('');
      const [modalVisible, setModalVisible] = useState(false);
      const [modalMessage, setModalMessage] = useState('');
      const [modalType, setModalType] = useState('success'); // 'success' or 'error'

      // Fetch user data on mount
      useEffect(() => {
        const fetchUserData = async () => {
          try {
            const id = await AsyncStorage.getItem('id');
            console.log('Retrieved ID from AsyncStorage:', id); // Debug log
            if (!id) {
              throw new Error('No user ID found. Please log in.');
            }

            const response = await fetch(`https://cravii.ng/cravii/api/get_user.php?id=${id}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
            });
            const contentType = response.headers.get('content-type');
            const text = await response.text();

            if (!contentType || !contentType.includes('application/json')) {
              throw new Error('Invalid server response');
            }

            const result = JSON.parse(text);
            console.log('Fetch User Data Response:', result); // Debug
            if (result.success) {
              const user = result.data;
              setName(user.name || '');
              setEmail(user.email || '');
              setLocation(user.location || '');
              setGender(user.gender || '');
              setReferralCode(user.referral_code || '');
            } else {
              throw new Error(result.message || 'Failed to fetch user data');
            }
          } catch (error) {
            console.error('Error fetching user data:', error.message);
            Alert.alert('Error', error.message, [
              { text: 'OK', onPress: () => router.push('/login') },
            ]);
          }
        };
        fetchUserData();
      }, [router]);

      // Function to handle form submission
      const handleSave = async () => {
        const id = await AsyncStorage.getItem('id');
        console.log('ID during save:', id); // Debug log
        if (!id) {
          setModalMessage('No user ID found. Please log in.');
          setModalType('error');
          setModalVisible(true);
          return;
        }

        const userData = { id, name, location, gender, referral_code: referralCode };

        try {
          const response = await fetch('https://cravii.ng/cravii/api/update_profile.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
          });

          const result = await response.json();
          console.log('API Response:', result); // Debug the response

          if (result.success) {
            setModalMessage(result.message || 'Profile updated successfully!');
            setModalType('success');
          } else {
            setModalMessage(result.message || 'Failed to update profile. Please try again.');
            setModalType('error');
          }
        } catch (error) {
          console.error('Error updating profile:', error);
          setModalMessage('An error occurred. Please check your network.');
          setModalType('error');
        } finally {
          setModalVisible(true);
        }
      };

      return (
        <View style={styles.container}>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          <ScrollView
            style={styles.scrollViewContent}
            contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top, backgroundColor: '#ffffff' }]}>
              <View style={styles.userInfo}>
                <Image source={PLACEHOLDER_AVATAR} style={styles.avatar} />
                <View>
                  <Text style={styles.greeting}>Hello {name || 'User'}</Text>
                  <View style={styles.location}>
                    <Feather name="map-pin" size={16} color="#4ade80" />
                    <Text style={styles.locationText}>{location}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.notificationButton}>
                <Feather name="bell" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Profile Section */}
            <View style={styles.profileSection}>
              <Text style={styles.profileTitle}>Profile Details</Text>
              <View style={styles.profileCard}>
                <TextInput
                  style={styles.profileInfoInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Name"
                />
                <TextInput
                  style={[styles.profileInfoInput, styles.readOnlyInput]}
                  value={email}
                  editable={false} // Read-only email
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.profileInfoInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Location"
                />
                <TextInput
                  style={styles.profileInfoInput}
                  value={gender}
                  onChangeText={setGender}
                  placeholder="Gender (e.g., Male/Female/Other)"
                />
                <TextInput
                  style={[styles.profileInfoInput, styles.readOnlyInput]}
                  value={referralCode}
                  editable={false} // Read-only referral code
                  placeholder="Referral Code"
                />
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Settings */}
            <View style={styles.settingsSection}>
              <Text style={styles.profileTitle}>Settings</Text>
              <TouchableOpacity style={styles.settingItem}>
                <Feather name="edit" size={20} color="#333" />
                <Text style={styles.settingText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingItem}>
                <Feather name="lock" size={20} color="#333" />
                <Text style={styles.settingText}>Change Password</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/influencers')}>
                <Feather name="dollar-sign" size={20} color="#333" />
                <Text style={styles.settingText}>Influencer Program</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => {
                  AsyncStorage.removeItem('id');
                  router.push('/login');
                }}
              >
                <Feather name="log-out" size={20} color="#333" />
                <Text style={styles.settingText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Bottom Navigation */}
          <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/restaurant')}>
              <Feather name="home" size={24} color="#999" />
              <Text style={styles.navText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/search')}>
              <Feather name="search" size={24} color="#999" />
              <Text style={styles.navText}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/cart')}>
              <Feather name="shopping-cart" size={24} color="#999" />
              <Text style={styles.navText}>My Cart</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
              <Feather name="user" size={24} color="#ff5722" />
              <Text style={styles.navTextActive}>Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Custom Modal */}
          <Modal
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalText}>
                  {modalType === 'success' ? '✅ ' : '❌ '} {modalMessage}
                </Text>
                <Pressable
                  style={styles.modalButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>OK</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </View>
      );
    }

   const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Softer background for a modern look
  },
  scrollViewContent: {
    flexGrow: 1, // Ensure content fills scroll view
    paddingBottom: 100, // Extra padding for bottom navigation
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60, // Slightly larger for prominence
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 3,
    borderColor: '#ff5722',
    shadowColor: '#ff5722',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  greeting: {
    fontSize: 18, // Larger for emphasis
    color: '#333',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginLeft: 6,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8f8f8', // Lighter background
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileSection: {
    paddingHorizontal: 20,
    paddingVertical: 25,
    backgroundColor: '#f5f5f5',
  },
  profileTitle: {
    fontSize: 24, // Larger for hierarchy
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20, // Softer corners
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  profileInfoInput: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    borderBottomWidth: 1.5,
    borderBottomColor: '#e0e0e0', // Softer border
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  readOnlyInput: {
    color: '#888',
    backgroundColor: '#f8f8f8',
    borderBottomColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#ff5722',
    borderRadius: 30, // More rounded
    paddingVertical: 12,
    paddingHorizontal: 30,
    alignSelf: 'center', // Centered for better UX
    marginTop: 20,
    shadowColor: '#ff5722',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  settingsSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#f5f5f5',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 15,
    borderRadius: 20, // Softer corners
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginLeft: 15,
    flex: 1, // Ensure text wraps properly
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 85, // Slightly taller for balance
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  navText: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    fontWeight: '600',
  },
  navTextActive: {
    fontSize: 12,
    color: '#ff5722',
    marginTop: 6,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker overlay for contrast
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20, // Softer corners
    padding: 25,
    width: '80%',
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#ff5722',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});