import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import SessionPicker from './pages/SessionPicker'
import Home from './pages/Home'
import History from './pages/History'
import Pot from './pages/Pot'
import Members from './pages/Members'
import MemberProfile from './pages/MemberProfile'
import Feed from './pages/Feed'
import Recap from './pages/Recap'
import EditGoals from './pages/EditGoals'
import Auth from './pages/Auth'
import { ThemeProvider } from './ThemeContext'
import { AuthProvider, useAuth } from './AuthContext'

function AppRoutes() {
  const { user } = useAuth()

  if (user === undefined) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!user) return <Auth />

  return (
    <Routes>
      <Route path="/" element={<SessionPicker />} />
      <Route path="/:sessionId" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="member/:name" element={<MemberProfile />} />
        <Route path="member/:name/goals" element={<EditGoals />} />
        <Route path="feed" element={<Feed />} />
        <Route path="history" element={<History />} />
        <Route path="pot" element={<Pot />} />
        <Route path="members" element={<Members />} />
        <Route path="recap" element={<Recap />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  )
}
