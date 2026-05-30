import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout() {
  return (
    <div className="min-h-screen bg-term-bg text-term-fg">
      <Sidebar />
      <TopBar />
      <main
        className="ml-[var(--sidebar-width)] pt-14 min-h-screen"
        style={{ minHeight: 'calc(100vh - 56px)' }}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
