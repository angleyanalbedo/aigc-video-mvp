import React from 'react';
import { useWorkbench } from './useWorkbench';
import { Layout } from 'antd';
import Header from './tabs/Header';
import MaterialsTab from './tabs/MaterialsTab';
import ScriptTab from './tabs/ScriptTab';
import StoryboardTab from './tabs/StoryboardTab';
import VideoTab from './tabs/VideoTab';
import AudioTab from './tabs/AudioTab';
import RenderTab from './tabs/RenderTab';
import SceneEditModal from './tabs/SceneEditModal';
import AudioLibraryModal from './tabs/AudioLibraryModal';

const { Content } = Layout;

const WorkbenchPage: React.FC = () => {
  const workbench = useWorkbench();
  const { activeTab } = workbench;

  return (
    <Layout style={{ height: '100%', minHeight: '100%', background: 'var(--page-bg)', color: 'var(--text-primary)' }}>
      <Header {...workbench} />

      {/* Main Dual-Column Content Panels */}
      <Content style={{ padding: 24, flex: 1, overflow: 'hidden' }}>
        {activeTab === 'materials' && <MaterialsTab {...workbench} />}
        {activeTab === 'script' && <ScriptTab {...workbench} />}
        {activeTab === 'storyboard' && <StoryboardTab {...workbench} />}
        {activeTab === 'video' && <VideoTab {...workbench} />}
        {activeTab === 'audio' && <AudioTab {...workbench} />}
        {activeTab === 'render' && <RenderTab {...workbench} />}
      </Content>

      {/* Global Modals */}
      <SceneEditModal {...workbench} />
      <AudioLibraryModal {...workbench} />
    </Layout>
  );
};

export default WorkbenchPage;
