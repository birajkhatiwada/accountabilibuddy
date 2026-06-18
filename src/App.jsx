import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import SubmitGoals from './pages/SubmitGoals'
import Pot from './pages/Pot'
import Members from './pages/Members'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/submit" element={<SubmitGoals />} />
        <Route path="/pot" element={<Pot />} />
        <Route path="/members" element={<Members />} />
      </Route>
    </Routes>
  )
}
