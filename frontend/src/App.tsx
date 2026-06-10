import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
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
import VideoLibraryPage from './pages/VideoLibrary';
import TemplateLibraryPage from './pages/TemplateLibrary';
import OneClickPage from './pages/OneClick';
import LoginPage from './pages/Login';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

// 认证守卫组件
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Dashboard wrapper for global pages sharing the sidebar layout
const DashboardWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <WorkbenchLayout>{children}</WorkbenchLayout>;
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Routes>
            {/* 公开路由 */}
            <Route path="/login" element={<LoginPage />} />

            {/* 受保护路由 */}
            <Route path="/workbench/:projectId" element={<RequireAuth><DashboardWrapper><WorkbenchPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/copilot/:projectId" element={<RequireAuth><CopilotPage /></RequireAuth>} />
            <Route path="/" element={<RequireAuth><DashboardWrapper><ProjectListPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/projects" element={<RequireAuth><DashboardWrapper><ProjectListPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/video-creation" element={<RequireAuth><DashboardWrapper><VideoCreationPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/task-center" element={<RequireAuth><DashboardWrapper><TaskCenterPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/materials" element={<RequireAuth><DashboardWrapper><MaterialManagementPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/attribution" element={<RequireAuth><DashboardWrapper><AttributionAnalysisPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/abtest" element={<RequireAuth><DashboardWrapper><ABTestPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/observability" element={<RequireAuth><DashboardWrapper><ObservabilityPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/compliance" element={<RequireAuth><DashboardWrapper><CompliancePage /></DashboardWrapper></RequireAuth>} />
            <Route path="/status" element={<RequireAuth><DashboardWrapper><StatusPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><DashboardWrapper><SettingsPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/video-library" element={<RequireAuth><DashboardWrapper><VideoLibraryPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/template-library" element={<RequireAuth><DashboardWrapper><TemplateLibraryPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/one-click" element={<RequireAuth><DashboardWrapper><OneClickPage /></DashboardWrapper></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
