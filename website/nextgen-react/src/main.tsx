import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { ProgramPage } from './pages/ProgramPage';
import { AdminLogin } from './pages/AdminLogin';
import { AdminLeads } from './pages/AdminLeads';
import { ACT_PAGE, SAT_PAGE, AP_PAGE } from './data/programs';
import './styles.css';
import './program.css';
import './admin.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/act" element={<ProgramPage data={ACT_PAGE} />} />
        <Route path="/sat" element={<ProgramPage data={SAT_PAGE} />} />
        <Route path="/ap" element={<ProgramPage data={AP_PAGE} />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/leads" element={<AdminLeads />} />
        <Route path="/admin" element={<Navigate to="/admin/leads" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
