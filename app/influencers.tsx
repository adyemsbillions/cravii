import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function Influencers() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [referralCode, setReferralCode] = useState('');
  const [referrals, setReferrals] = useState<{ name: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getUserData = async () => {
      try {
        const id = await AsyncStorage.getItem('id');
        console.log('Retrieved ID from AsyncStorage:', id);
        if (!id) {
          throw new Error('No user ID found. Please log in.');
        }
        setUserId(id);

        const userResponse = await fetch(`https://cravii.ng/cravii/api/get_user.php?id=${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });
        console.log('get_user.php status:', userResponse.status);
        console.log('get_user.php headers:', userResponse.headers);
        const userText = await userResponse.text();
        console.log('get_user.php raw response:', userText);

        if (!userText) {
          throw new Error('Empty response from get_user.php');
        }
        if (!userResponse.headers.get('content-type')?.includes('application/json')) {
          throw new Error(`Invalid content type from get_user.php: ${userResponse.headers.get('content-type')}`);
        }

        let userData;
        try {
          userData = JSON.parse(userText);
        } catch (parseError) {
          console.error('JSON parse error for get_user.php:', parseError);
          throw new Error('Failed to parse get_user.php response');
        }

        if (!userData.success) {
          console.error('get_user.php failed:', userData.message);
          throw new Error(userData.message || 'Failed to fetch user data');
        }

        setReferralCode(userData.data.referral_code || '');
        console.log('get_user.php succeeded, referral_code:', userData.data.referral_code);

        if (!userData.data.referral_code) {
          const randomNum = Math.floor(Math.random() * 900) + 100;
          const newCode = `cravii${randomNum}`;
          setReferralCode(newCode);

          const updateResponse = await fetch(`https://cravii.ng/cravii/api/update_referral_code.php`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, referral_code: newCode }),
          });
          console.log('update_referral_code.php status:', updateResponse.status);
          const updateText = await updateResponse.text();
          console.log('update_referral_code.php raw response:', updateText);

          if (!updateText) {
            throw new Error('Empty response from update_referral_code.php');
          }
          if (!updateResponse.headers.get('content-type')?.includes('application/json')) {
            throw new Error(`Invalid content type from update_referral_code.php: ${updateResponse.headers.get('content-type')}`);
          }

          let updateResult;
          try {
            updateResult = JSON.parse(updateText);
          } catch (parseError) {
            console.error('JSON parse error for update_referral_code.php:', parseError);
            throw new Error('Failed to parse update_referral_code.php response');
          }

          if (!updateResult.success) {
            console.error('Failed to save referral code:', updateResult.message);
            throw new Error('Failed to save referral code');
          }
        }

        const response = await fetch(`https://cravii.ng/cravii/api/get_referrals.php?id=${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });
        console.log('get_referrals.php status:', response.status);
        console.log('get_referrals.php headers:', response.headers);
        const text = await response.text();
        console.log('get_referrals.php raw response:', text);

        if (!text) {
          throw new Error('Empty response from get_referrals.php');
        }
        if (!response.headers.get('content-type')?.includes('application/json')) {
          throw new Error(`Invalid content type from get_referrals.php: ${response.headers.get('content-type')}`);
        }

        let result;
        try {
          result = JSON.parse(text);
        } catch (parseError) {
          console.error('JSON parse error for get_referrals.php:', parseError);
          throw new Error('Failed to parse get_referrals.php response');
        }

        if (result.success) {
          setReferrals(Array.isArray(result.data) ? result.data.map(item => ({
            name: String(item.name || 'Unknown User')
          })) : []);
        } else {
          console.error('Failed to fetch referrals:', result.message);
          throw new Error(result.message || 'Failed to load referrals');
        }
      } catch (error) {
        console.error('Error in influencers page:', error);
        setError(error.message || 'Failed to load data. Please try again.');
      }
    };
    getUserData();
  }, []);

  const rewards = [
    { users: 50, amount: 10000 },
    { users: 100, amount: 25000 },
    { users: 500, amount: 150000 },
    { users: 1000, amount: 400000 },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        style={styles.scrollViewContent}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Influencer Program</Text>
          <View style={{ width: 24 }} />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.title}>Earn Money with Cravii Referrals</Text>
          <Text style={styles.description}>
            Share your unique referral code with friends. When they use it during checkout, you earn rewards!
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.subtitle}>Your Referral Code</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.code}>{referralCode || 'Generating...'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.subtitle}>Reward Tiers</Text>
          {rewards.map((tier, index) => (
            <View key={index} style={styles.tierItem}>
              <Feather name="award" size={20} color="#ff5722" style={styles.tierIcon} />
              <Text style={styles.tierText}>
                {tier.users} users: ₦{tier.amount.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.subtitle}>People Who Used Your Code ({referrals.length})</Text>
          {referrals.length > 0 ? (
            referrals.map((ref, index) => (
              <View key={index} style={styles.referralItem}>
                <Feather name="user-check" size={18} color="#4ade80" style={styles.referralIcon} />
                <Text style={styles.referralName}>{ref.name}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noReferrals}>No one has used your code yet. Start sharing!</Text>
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
  scrollViewContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
  errorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    marginHorizontal: 20,
    marginTop: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 25,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  code: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff5722',
  },
  tierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tierIcon: {
    marginRight: 10,
  },
  tierText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  referralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  referralIcon: {
    marginRight: 10,
  },
  referralName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  noReferrals: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
});