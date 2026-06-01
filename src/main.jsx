import React from 'react'
import ReactDOM from 'react-dom/client'
import Admin from '../admin.jsx'
import Mesa from '../mesa.jsx'
import Kiosco from '../kiosco.jsx'

const FORCED_VIEW = import.meta.env.VITE_FORCE_VIEW || ''

function AppShell() {
  if (FORCED_VIEW === 'admin') return <Admin />
  if (FORCED_VIEW === 'mesa') return <Mesa />
  if (FORCED_VIEW === 'kiosco') return <Kiosco />

  // fallback de desarrollo: selector visible solo si no hay VITE_FORCE_VIEW
  const [view, setView] = React.useState(() => {
    const params = new URLSearchParams(window.location.search)
    return (params.get('view') || 'admin').toLowerCase() === 'mesa' ? 'mesa' : 'admin'
  })

  return (
    <div>
      <div style={{
        position: 'fixed', top: 12, right: 12, zIndex: 9999,
        display: 'flex', gap: 8, padding: 8, borderRadius: 14,
        background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(12px)', color: 'white'
      }}>
        <button onClick={() => setView('admin')} style={{padding:'8px 12px',borderRadius:10,border:0,cursor:'pointer',fontWeight:700,opacity:view==='admin'?1:.6}}>Admin</button>
        <button onClick={() => setView('mesa')} style={{padding:'8px 12px',borderRadius:10,border:0,cursor:'pointer',fontWeight:700,opacity:view==='mesa'?1:.6}}>Mesa</button>
      </div>
      {view === 'admin' ? <Admin /> : <Mesa />}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
)
