import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

interface DashboardScreenProps {
  username?: string;
  onLogout: () => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ username, onLogout }) => {
  const handleLogout = () => {
    onLogout();
  };
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>NAIRA BANK</Text>
          </View>
          <Text style={styles.headerTitle}>Personal Internet Banking</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Welcome Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome to Your Dashboard</Text>
          <Text style={styles.cardText}>
            You have successfully logged in to Naira Bank Personal Internet Banking.
          </Text>
          {username && (
            <View style={styles.userInfo}>
              <Text style={styles.userInfoLabel}>Logged in as:</Text>
              <Text style={styles.userInfoValue}>{username}</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <View style={styles.quickActionCard}>
            <Text style={styles.quickActionIcon}>💰</Text>
            <Text style={styles.quickActionTitle}>Account Balance</Text>
            <Text style={styles.quickActionText}>
              View your account balance and transaction history
            </Text>
          </View>

          <View style={styles.quickActionCard}>
            <Text style={styles.quickActionIcon}>📤</Text>
            <Text style={styles.quickActionTitle}>Transfer Funds</Text>
            <Text style={styles.quickActionText}>
              Transfer money to other accounts securely
            </Text>
          </View>

          <View style={styles.quickActionCard}>
            <Text style={styles.quickActionIcon}>💳</Text>
            <Text style={styles.quickActionTitle}>Pay Bills</Text>
            <Text style={styles.quickActionText}>
              Pay your utility bills and other services
            </Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Activity</Text>
          <Text style={styles.cardText}>No recent transactions to display.</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © 2024 NAIRA BANK PLC (LICENSED BY THE CENTRAL BANK OF NIGERIA)
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  logo: {
    width: 96,
    height: 48,
    backgroundColor: '#90E93B',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  logoutButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#90E93B',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  userInfo: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 6,
    marginTop: 8,
  },
  userInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  userInfoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  quickActions: {
    gap: 16,
  },
  quickActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default DashboardScreen;

