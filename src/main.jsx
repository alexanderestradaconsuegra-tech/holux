import React, { useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import Admin from '../admin.jsx'
import Mesa from '../mesa.jsx'

function AppShell() {
  const initialView = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const view = (params.get('view') || 'admin').toLowerCase()
    return view === 'mesa' ? 'mesa' : 'admin'
  }, [])

  const [view, setView] = useState(initialView)

  return (
    <div>
      <div style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 9999,
        display: 'flex',
        gap: 8,
        padding: 8,
        borderRadius: 14,
        background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(12px)',
        color: 'white'
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
