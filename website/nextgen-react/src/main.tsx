import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { ProgramPage } from './pages/ProgramPage';
import { FutureProgramsPage } from './pages/FutureProgramsPage';
import { K12TutoringPage } from './pages/K12TutoringPage';
import { AboutUsPage } from './pages/AboutUsPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { AdminLogin } from './pages/AdminLogin';
import { AdminLeads } from './pages/AdminLeads';
import { CareersPage } from './pages/CareersPage';
import { EnquiryPage } from './pages/EnquiryPage';
import { FreeTestPage } from './pages/FreeTestPage';
import { WhatsAppButton } from './components/WhatsAppButton';
import { ACT_PAGE, SAT_PAGE, AP_PAGE } from './data/programs';
import { initMetaPixel } from './lib/metaPixel';
import './styles.css';
import './program.css';
import './future-programs.css';
import './k12-tutoring.css';
import './about-us.css';
import './resources.css';
import './admin.css';
import './careers.css';
import './free-test.css';

initMetaPixel();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/act" element={<ProgramPage data={ACT_PAGE} />} />
        <Route path="/sat" element={<ProgramPage data={SAT_PAGE} />} />
        <Route path="/ap" element={<ProgramPage data={AP_PAGE} />} />
        <Route path="/future-programs" element={<FutureProgramsPage />} />
        <Route path="/k-12-tutoring" element={<K12TutoringPage />} />
        <Route path="/about-us" element={<AboutUsPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/consultation" element={<EnquiryPage />} />
        <Route path="/enquiry" element={<EnquiryPage />} />
        <Route path="/free-test" element={<FreeTestPage />} />
        <Route path="/free-test/:testId" element={<FreeTestPage />} />
        <Route path="/take-free-test" element={<Navigate to="/free-test" replace />} />
        <Route path="/about" element={<Navigate to="/about-us" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/leads" element={<AdminLeads />} />
        <Route path="/admin" element={<Navigate to="/admin/leads" replace />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <WhatsAppButton />
    </BrowserRouter>
  </StrictMode>,
);
