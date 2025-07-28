import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import UploadScreen from '../screens/UploadScreen';
import TaskListScreen from '../screens/TaskListScreen';
import MarkdownPreviewScreen from '../screens/MarkdownPreviewScreen';
import BrandingScreen from '../screens/BrandingScreen';

export type RootStackParamList = {
  Home: undefined;
  Upload: undefined;
  Tasks: undefined;
  Preview: undefined;
  Branding: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Upload" component={UploadScreen} />
        <Stack.Screen name="Tasks" component={TaskListScreen} />
        <Stack.Screen name="Preview" component={MarkdownPreviewScreen} />
        <Stack.Screen name="Branding" component={BrandingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
