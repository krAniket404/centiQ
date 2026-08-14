import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Export auth and firestore so we can use them anywhere in the app
export { auth, firestore };

// Login function
export const signIn = async (email: string, password: string) => {
  return await auth().signInWithEmailAndPassword(email, password);
};

// Signup function
export const signUp = async (email: string, password: string) => {
  const userCredential = await auth().createUserWithEmailAndPassword(email, password);

  // Create a profile for the user in Firestore
  await firestore().collection('profiles').doc(userCredential.user.uid).set({
    subscription_status: 'trialing',
    trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  });

  return userCredential;
};

// Logout function
export const signOut = async () => {
  return await auth().signOut();
};