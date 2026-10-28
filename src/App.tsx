import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { PresenceProvider } from './presence'
import Layout from './components/Layout'
import { Login, Register } from './pages/Auth'
import Home from './pages/Home'
import QA from './pages/QA'
import Calendar from './pages/Calendar'
import Ideas from './pages/Ideas'
import IdeaDetail from './pages/IdeaDetail'
import Products from './pages/Products'
import Todos from './pages/Todos'
import Activity from './pages/Activity'
import Team from './pages/Team'
import Boards from './pages/Boards'
import Board from './pages/Board'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'

export default function App() {
  const { token } = useAuth()
  if (!token)
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  return (
    <PresenceProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/qa" element={<QA />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/ideas/:id" element={<IdeaDetail />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/team" element={<Team />} />
          <Route path="/boards" element={<Boards />} />
          <Route path="/boards/:id" element={<Board />} />
          <Route path="/products" element={<Products />} />
          <Route path="/tasks" element={<Todos />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </PresenceProvider>
  )
}
