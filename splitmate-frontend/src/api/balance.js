import { TESTING_URL } from "../Apilinks";



// Get balance for a specific group
export const getGroupBalance = async (groupId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${TESTING_URL}/balance/${groupId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching group balance:', error);
    throw error;
  }
};

// Get overall balance for current user across all groups
export const getOverallBalance = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${TESTING_URL}/balance/overall/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching overall balance:', error);
    throw error;
  }
};