import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from './firebase'

const AuthContext = createContext(null)

const toEmail = (username) => `${username.trim().toLowerCase()}@accountabilibuddy.app`

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const signUp = async (username, password) => {
    const cred = await createUserWithEmailAndPassword(auth, toEmail(username), password)
    await updateProfile(cred.user, { displayName: username.trim() })
    setUser({ ...cred.user, displayName: username.trim() })
  }

  const signIn = async (username, password) => {
    await signInWithEmailAndPassword(auth, toEmail(username), password)
  }

  const signOut = () => fbSignOut(auth)

  return (
    <AuthContext.Provider value={{ user, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
