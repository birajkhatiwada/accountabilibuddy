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
import { ThemeProvider } from './ThemeContext'

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<SessionPicker />} />
        <Route path="/:sessionId" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="member/:name" element={<MemberProfile />} />
          <Route path="feed" element={<Feed />} />
          <Route path="history" element={<History />} />
          <Route path="pot" element={<Pot />} />
          <Route path="members" element={<Members />} />
          <Route path="recap" element={<Recap />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}
