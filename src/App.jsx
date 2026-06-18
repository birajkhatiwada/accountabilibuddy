import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import SubmitGoals from './pages/SubmitGoals'
import Pot from './pages/Pot'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/submit" element={<SubmitGoals />} />
        <Route path="/pot" element={<Pot />} />
      </Route>
    </Routes>
  )
}
