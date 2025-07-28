import { SafeAreaView } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <RootNavigator />
    </SafeAreaView>
  );
}
