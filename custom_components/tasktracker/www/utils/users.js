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

export function getCurrentUsername(config, hass, availableUsers = null) {
  switch (config.user_filter_mode) {
    case 'explicit':
      return config.explicit_user;

    case 'current':
      // Try to map the current HA user to a TaskTracker username
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

export function getUsernameForAction(config, hass, availableUsers = null) {
  let username = getCurrentUsername(config, hass, availableUsers);

  // If we're in "all users" mode and no username is configured,
  // return null to let the backend handle user mapping via call context
  if (config.user_filter_mode === 'all' && !username) {
    return null;
  }

  return username;
}
