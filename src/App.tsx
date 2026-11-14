import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './lib/data'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Home from './pages/Home'
import TripPage from './pages/TripPage'
import Register from './pages/Register'
import MapPage from './pages/MapPage'
import Trips from './pages/Trips'
import Me from './pages/Me'
import Admin from './pages/Admin'

function Gate() {
  const { session, authReady, data, error } = useApp()
  if (!authReady) return <Spinner />
  if (!session) return <Login />
  if (error) return <p role="alert" className="p-10 text-center">לא הצלחנו לטעון את הנתונים. נסו לרענן את הדף.</p>
  if (!data) return <Spinner />
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/trips" element={<Trips />} />
      <Route path="/trip/:id" element={<TripPage />} />
      <Route path="/trip/:id/register" element={<Register />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/me" element={<Me />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AppProvider>
  )
}
