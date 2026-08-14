import AsyncStorage from '@react-native-async-storage/async-storage';

// These functions match what you were doing with SmsModule, but 100% reliable
export const loadData = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    console.warn("Failed to load data", e);
    return null;
  }
};

export const saveData = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.warn("Failed to save data", e);
  }
};