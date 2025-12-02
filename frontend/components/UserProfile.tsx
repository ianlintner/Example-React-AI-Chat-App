import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar, Menu } from 'react-native-paper';
import { authService, User } from '../services/authService';
import { ForestColors } from '../constants/Colors';

export const UserProfile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const cachedUser = await authService.getUser();
        if (cachedUser) {
          setUser(cachedUser);
        }

        const token = await authService.getToken();
        const fetchedUser = await authService.fetchCurrentUser(token);
        if (fetchedUser) {
          setUser(fetchedUser);
          await authService.setUser(fetchedUser);
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    void loadUser();
  }, []);

  useEffect(() => {
    if (!user) {
      console.warn(
        '[UserProfile] No user profile provided. Using anonymous defaults.',
      );
      return;
    }

    const missingFields: string[] = [];
    if (!user.name?.trim()) {
      missingFields.push('name');
    }
    if (!user.email?.trim()) {
      missingFields.push('email');
    }
    if (!user.avatar?.trim()) {
      missingFields.push('avatar');
    }

    if (missingFields.length > 0) {
      console.warn(
        `[UserProfile] Missing user properties: ${missingFields.join(
          ', ',
        )}. Using defaults where necessary.`,
      );
    }
  }, [user]);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleLogout = async () => {
    closeMenu();
    await authService.logout();
    // In production with oauth2-proxy, redirect to /oauth2/sign_out
    if (typeof window !== 'undefined') {
      window.location.href = '/oauth2/sign_out';
    }
  };

  const sanitizedName = user?.name?.trim();
  const sanitizedEmail = user?.email?.trim();
  const sanitizedAvatar = user?.avatar?.trim();

  const displayName =
    sanitizedName && sanitizedName.length > 0 ? sanitizedName : 'Anonymous';
  const displayEmail =
    sanitizedEmail && sanitizedEmail.length > 0
      ? sanitizedEmail
      : 'Information not provided';
  const hasAvatar = Boolean(sanitizedAvatar);
  const avatarInitials = displayName.substring(0, 2).toUpperCase();

  return (
    <View style={styles.container}>
      <Menu
        visible={menuVisible}
        onDismiss={closeMenu}
        anchor={
          <TouchableOpacity onPress={openMenu} style={styles.profileButton}>
            {hasAvatar ? (
              <Avatar.Image size={40} source={{ uri: sanitizedAvatar }} />
            ) : (
              <Avatar.Text
                size={40}
                label={avatarInitials}
                style={styles.avatarText}
              />
            )}
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {displayEmail}
              </Text>
            </View>
          </TouchableOpacity>
        }
      >
        <Menu.Item
          onPress={() => {
            closeMenu();
            // Navigate to profile settings if available
          }}
          title='Profile Settings'
          leadingIcon='account-cog'
        />
        <Menu.Item
          onPress={handleLogout}
          title='Sign Out'
          leadingIcon='logout'
        />
      </Menu>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1000,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ForestColors.surface,
    borderRadius: 25,
    paddingVertical: 5,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userInfo: {
    marginLeft: 10,
    maxWidth: 150,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: ForestColors.text,
  },
  userEmail: {
    fontSize: 11,
    color: ForestColors.textSecondary,
  },
  avatarText: {
    backgroundColor: ForestColors.primary,
  },
});
