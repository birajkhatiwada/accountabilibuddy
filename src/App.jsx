import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import History from './pages/History'
import Pot from './pages/Pot'
import Members from './pages/Members'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/history" element={<History />} />
        <Route path="/pot" element={<Pot />} />
        <Route path="/members" element={<Members />} />
      </Route>
    </Routes>
  )
}
