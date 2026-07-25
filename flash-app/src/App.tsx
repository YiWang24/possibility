import { useState } from 'react';
import './App.css';
import HomePage from './pages/HomePage';
import LabPage from './pages/LabPage';
import CommunityPage from './pages/CommunityPage';
import MePage from './pages/MePage';
import TabBar from './components/TabBar';

export type TabId = 'home' | 'lab' | 'comm' | 'me';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');

  return (
    <div id="container" className="flex flex-col h-full relative">
      <div className="flex-1 overflow-hidden relative">
        <div className={`page-screen ${activeTab === 'home' ? 'active' : ''}`}>
          <HomePage />
        </div>
        <div className={`page-screen ${activeTab === 'lab' ? 'active' : ''}`}>
          <LabPage />
        </div>
        <div className={`page-screen ${activeTab === 'comm' ? 'active' : ''}`}>
          <CommunityPage />
        </div>
        <div className={`page-screen ${activeTab === 'me' ? 'active' : ''}`}>
          <MePage />
        </div>
      </div>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
