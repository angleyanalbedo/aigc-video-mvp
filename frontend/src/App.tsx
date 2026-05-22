import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WorkbenchLayout from './layouts/WorkbenchLayout';
import VideoCreationPage from './pages/VideoCreation';
import TaskCenterPage from './pages/TaskCenter';
import MaterialManagementPage from './pages/MaterialManagement';
import AttributionAnalysisPage from './pages/AttributionAnalysis';
import ABTestPage from './pages/ABTest';
import ObservabilityPage from './pages/Observability';
import CompliancePage from './pages/Compliance';
import Dashboard from './Dashboard';
import './App.css';

function App() {
  return (
    <Router>
      <WorkbenchLayout>
        <Routes>
          <Route path="/" element={<VideoCreationPage />} />
          <Route path="/video-creation" element={<VideoCreationPage />} />
          <Route path="/task-center" element={<TaskCenterPage />} />
          <Route path="/materials" element={<MaterialManagementPage />} />
          <Route path="/attribution" element={<AttributionAnalysisPage />} />
          <Route path="/abtest" element={<ABTestPage />} />
          <Route path="/observability" element={<ObservabilityPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </WorkbenchLayout>
    </Router>
  );
}

export default App;
