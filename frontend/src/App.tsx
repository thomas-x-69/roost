import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Devices from './pages/Devices'
import Dashboard from './pages/Dashboard'
import Schedules from './pages/Schedules'
import Usage from './pages/Usage'
import TopSites from './pages/TopSites'
import Alerts from './pages/Alerts'
import Threats from './pages/Threats'
import Groups from './pages/Groups'
import Reports from './pages/Reports'
import { useWebSocket } from './hooks/useWebSocket'

function AppInner() {
  useWebSocket()  // Start WS connection at app level
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="devices" element={<Devices />} />
        <Route path="schedules" element={<Schedules />} />
        <Route path="usage" element={<Usage />} />
        <Route path="top-sites" element={<TopSites />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="threats" element={<Threats />} />
        <Route path="groups" element={<Groups />} />
        <Route path="reports" element={<Reports />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <AppInner />
}
