import { View, Text, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useBRDRuns } from '../hooks/useBRDRuns';

export default function UploadScreen() {
  const [templateId, setTemplateId] = useState('');
  const { data, isLoading, error } = useBRDRuns(templateId);

  return (
    <View className="flex-1 p-4 bg-white">
      <Text className="text-lg font-bold mb-2">Fetch BRD Runs</Text>
      <TextInput
        className="border p-2 mb-4"
        placeholder="Enter Template ID"
        value={templateId}
        onChangeText={setTemplateId}
      />
      {isLoading && <ActivityIndicator />}
      {error && <Text className="text-red-500">Error loading runs</Text>}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="p-2 border-b">
            <Text className="font-semibold">{item.name}</Text>
            <Text className="text-xs text-gray-500">{item.id}</Text>
          </View>
        )}
      />
    </View>
  );
}
