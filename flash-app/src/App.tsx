import './styles/prototype.css';
import './styles/app-shell.css';

import { useAppStore } from '@/store/appStore';
import TabBar from '@/components/TabBar';
import Toast from '@/components/Toast';
import HomeScreen from '@/screens/HomeScreen';
import LabScreen from '@/screens/LabScreen';
import CommScreen from '@/screens/CommScreen';
import MeScreen from '@/screens/MeScreen';
import DiaryPush from '@/screens/push/DiaryPush';
import ChatPush from '@/screens/push/ChatPush';
import CardGameHubPush from '@/screens/push/CardGameHubPush';
import ResultPush from '@/screens/push/ResultPush';
import ProfilePush from '@/screens/push/ProfilePush';
import BountyPush from '@/screens/push/BountyPush';
import ProfileStudioPush from '@/screens/push/ProfileStudioPush';
import ContextPush from '@/screens/push/ContextPush';
import MyEditPush from '@/screens/push/MyEditPush';

function App() {
  const tab = useAppStore((s) => s.tab);

  return (
    <div id="container">
      <HomeScreen active={tab === 'home'} />
      <LabScreen active={tab === 'lab'} />
      <CommScreen active={tab === 'comm'} />
      <MeScreen active={tab === 'me'} />

      {/* Push pages — each reads its own open state from the store. */}
      <DiaryPush />
      <ChatPush />
      <CardGameHubPush />
      <ResultPush />
      <ProfilePush />
      <BountyPush />
      <ProfileStudioPush />
      <ContextPush />
      <MyEditPush />

      <Toast />
      <TabBar />
    </div>
  );
}

export default App;
