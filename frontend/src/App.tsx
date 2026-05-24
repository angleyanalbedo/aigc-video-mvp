import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WorkbenchLayout from './layouts/WorkbenchLayout';
import VideoCreationPage from './pages/VideoCreation';
import TaskCenterPage from './pages/TaskCenter';
import MaterialManagementPage from './pages/MaterialManagement';
import AttributionAnalysisPage from './pages/AttributionAnalysis';
import ABTestPage from './pages/ABTest';
import ObservabilityPage from './pages/Observability';
import CompliancePage from './pages/Compliance';
import ProjectListPage from './pages/ProjectList';
import WorkbenchPage from './pages/Workbench';
import CopilotPage from './pages/Copilot';
import Dashboard from './Dashboard';
import StatusPage from './pages/Status';
import SettingsPage from './pages/Settings';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

// Dashboard wrapper for global pages sharing the sidebar layout
const DashboardWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <WorkbenchLayout>{children}</WorkbenchLayout>;
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Dynamic, Focused Workbench Studio (Sidebar adapts to project context) */}
          <Route path="/workbench/:projectId" element={<DashboardWrapper><WorkbenchPage /></DashboardWrapper>} />
          
          {/* Copilot AI Agent Studio - No side panel layout */}
          <Route path="/copilot/:projectId" element={<CopilotPage />} />

          {/* Global Management Portal (With Left Sidebar Navigation) */}
          <Route path="/" element={<DashboardWrapper><ProjectListPage /></DashboardWrapper>} />
          <Route path="/projects" element={<DashboardWrapper><ProjectListPage /></DashboardWrapper>} />
          <Route path="/video-creation" element={<DashboardWrapper><VideoCreationPage /></DashboardWrapper>} />
          <Route path="/task-center" element={<DashboardWrapper><TaskCenterPage /></DashboardWrapper>} />
          <Route path="/materials" element={<DashboardWrapper><MaterialManagementPage /></DashboardWrapper>} />
          <Route path="/attribution" element={<DashboardWrapper><AttributionAnalysisPage /></DashboardWrapper>} />
          <Route path="/abtest" element={<DashboardWrapper><ABTestPage /></DashboardWrapper>} />
          <Route path="/observability" element={<DashboardWrapper><ObservabilityPage /></DashboardWrapper>} />
          <Route path="/compliance" element={<DashboardWrapper><CompliancePage /></DashboardWrapper>} />
          <Route path="/status" element={<DashboardWrapper><StatusPage /></DashboardWrapper>} />
          <Route path="/settings" element={<DashboardWrapper><SettingsPage /></DashboardWrapper>} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
