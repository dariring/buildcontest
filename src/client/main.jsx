import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'
import Home from './pages/Home.jsx'
import Admin from './pages/Admin.jsx'

// 화면이 둘뿐이라 라우터를 따로 두지 않습니다. 서버가 어떤 주소로 들어와도
// 같은 index.html 을 내려주므로, 여기서 경로만 보고 갈라주면 충분합니다.
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>{isAdmin ? <Admin /> : <Home />}</StrictMode>,
)
