import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import WorkbenchLayout from './layouts/WorkbenchLayout'
import VideoCreationPage from './pages/VideoCreation'
import TaskCenterPage from './pages/TaskCenter'
import Dashboard from './Dashboard'
import './App.css'

function App() {
  return (
    <Router>
      <WorkbenchLayout>
        <Routes>
          <Route path="/" element={<VideoCreationPage />} />
          <Route path="/task-center" element={<TaskCenterPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </WorkbenchLayout>
    </Router>
  )
}

export default App
