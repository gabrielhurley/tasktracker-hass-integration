export async function getAvailableUsers(hass) {
  try {
    const response = await hass.callService('tasktracker', 'get_available_users', {}, {}, true, true);
    if (response && response.response && response.response.data && response.response.data.users) {
      return response.response.data.users;
    }
  } catch (error) {
    console.warn('Failed to fetch available users:', error);
  }
  // Fallback to empty array if service fails
  return [];
}

export async function getEnhancedUsers(hass) {
  try {
    const response = await hass.callService('tasktracker', 'get_available_users', {}, {}, true, true);
    if (response && response.response && response.response.data) {
      // Return enhanced users if available, otherwise fallback to basic users
      if (response.response.data.enhanced_users) {
        return response.response.data.enhanced_users;
      } else if (response.response.data.users) {
        // Create basic enhanced user objects from usernames
        return response.response.data.users.map(username => ({
          username: username,
          display_name: username,
          ha_user_id: null,
        }));
      }
    }
  } catch (error) {
    console.warn('Failed to fetch enhanced users:', error);
  }
  // Fallback to empty array if service fails
  return [];
}

export function getUserDisplayName(username, enhancedUsers) {
  if (!enhancedUsers || !Array.isArray(enhancedUsers)) {
    return username;
  }

  const userMapping = enhancedUsers.find(user => user.username === username);
  return userMapping ? userMapping.display_name : username;
}

export function getUsernameFromDisplayName(displayName, enhancedUsers) {
  if (!enhancedUsers || !Array.isArray(enhancedUsers)) {
    return displayName;
  }

  const userMapping = enhancedUsers.find(user => user.display_name === displayName);
  return userMapping ? userMapping.username : displayName;
}

/**
 * Check if the current Home Assistant user is properly mapped to a TaskTracker user
 * @param {Object} hass - Home Assistant object
 * @param {Array} enhancedUsers - Enhanced users from get_available_users API
 * @returns {boolean} True if current user is mapped, false otherwise
 */
export function isCurrentUserMapped(hass, enhancedUsers) {
  if (!hass || !hass.user || !hass.user.id || !enhancedUsers || !Array.isArray(enhancedUsers)) {
    return false;
  }

  const currentUserId = hass.user.id;

  // Check if current HA user ID is mapped to any TaskTracker user
  return enhancedUsers.some(user => user.ha_user_id === currentUserId);
}

/**
 * Get the TaskTracker username for the current Home Assistant user
 * @param {Object} hass - Home Assistant object
 * @param {Array} enhancedUsers - Enhanced users from get_available_users API
 * @returns {string|null} TaskTracker username if mapped, null otherwise
 */
export function getCurrentUserMappedUsername(hass, enhancedUsers) {
  if (!hass || !hass.user || !hass.user.id || !enhancedUsers || !Array.isArray(enhancedUsers)) {
    return null;
  }

  const currentUserId = hass.user.id;

  const mappedUser = enhancedUsers.find(user => user.ha_user_id === currentUserId);
  return mappedUser ? mappedUser.username : null;
}

export function getCurrentUsername(config, hass, availableUsers = null, enhancedUsers = null) {
  switch (config.user_filter_mode) {
    case 'explicit':
      return config.explicit_user;

    case 'current':
      // First, try to use proper user mapping if enhancedUsers is available
      if (enhancedUsers) {
        return getCurrentUserMappedUsername(hass, enhancedUsers);
      }

      // Fallback to legacy name-based matching for backward compatibility
      if (hass && hass.user && hass.user.name && availableUsers) {
        const currentUserName = hass.user.name.toLowerCase();

        // First try exact lowercase match
        if (availableUsers.includes(currentUserName)) {
          return currentUserName;
        }

        // Try case-insensitive match
        const matchedUser = availableUsers.find(user =>
          user.toLowerCase() === currentUserName,
        );
        if (matchedUser) {
          return matchedUser;
        }

        // Try to match by first name if full name doesn't work
        const firstName = hass.user.name.split(' ')[0].toLowerCase();
        if (availableUsers.includes(firstName)) {
          return firstName;
        }

        // Try case-insensitive first name match
        const matchedFirstName = availableUsers.find(user =>
          user.toLowerCase() === firstName,
        );
        if (matchedFirstName) {
          return matchedFirstName;
        }
      }

      // If no availableUsers provided or no match found, return null
      // Backend will handle user mapping via call context as fallback
      return null;

    case 'all':
    default:
      return null; // No username filter
  }
}

export function hasValidUserConfig(config) {
  return (
    config.user_filter_mode &&
    (config.user_filter_mode === 'all' ||
      config.user_filter_mode === 'current' ||
      (config.user_filter_mode === 'explicit' && config.explicit_user))
  );
}

/**
 * Check if current user can make API requests
 * @param {Object} config - Card configuration
 * @param {Object} hass - Home Assistant object
 * @param {Array} enhancedUsers - Enhanced users from get_available_users API
 * @returns {Object} { canMakeRequests: boolean, error: string|null, username: string|null }
 */
export function validateCurrentUser(config, hass, enhancedUsers = null) {
  if (!hasValidUserConfig(config)) {
    return {
      canMakeRequests: false,
      error: 'No user configured. Please set user in card configuration.',
      username: null
    };
  }

  // For explicit and all modes, always allow requests
  if (config.user_filter_mode === 'explicit' || config.user_filter_mode === 'all') {
    const username = getCurrentUsername(config, hass, null, enhancedUsers);
    return {
      canMakeRequests: true,
      error: null,
      username
    };
  }

  // For current user mode, validate that the user is mapped
  if (config.user_filter_mode === 'current') {
    if (!enhancedUsers || !Array.isArray(enhancedUsers)) {
      // If we don't have enhanced users data yet, allow the request
      // This maintains backward compatibility
      const username = getCurrentUsername(config, hass, null, enhancedUsers);
      return {
        canMakeRequests: true,
        error: null,
        username
      };
    }

    if (!isCurrentUserMapped(hass, enhancedUsers)) {
      return {
        canMakeRequests: false,
        error: 'Current user is not mapped to a TaskTracker user. Please configure user mapping in the integration settings.',
        username: null
      };
    }

    const username = getCurrentUserMappedUsername(hass, enhancedUsers);
    return {
      canMakeRequests: true,
      error: null,
      username
    };
  }

  return {
    canMakeRequests: false,
    error: 'Invalid user configuration.',
    username: null
  };
}

export function getUsernameForAction(config, hass, availableUsers = null, enhancedUsers = null) {
  let username = getCurrentUsername(config, hass, availableUsers, enhancedUsers);

  // If we're in "all users" mode and no username is configured,
  // return null to let the backend handle user mapping via call context
  if (config.user_filter_mode === 'all' && !username) {
    return null;
  }

  return username;
}
