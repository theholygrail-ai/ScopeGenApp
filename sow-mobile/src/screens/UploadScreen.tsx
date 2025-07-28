import { View, Text, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { uploadBRDFile } from '../services/api';

export default function UploadScreen() {
  const [file, setFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [serverResponse, setServerResponse] = useState('');

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });

    if (result.type === 'success') {
      setFile(result);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setUploading(true);
      const response = await uploadBRDFile(file);
      setServerResponse(response?.message || 'Uploaded successfully!');
    } catch (err) {
      setServerResponse('Upload failed.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="flex-1 p-4 bg-white">
      <Text className="text-xl font-bold mb-4">📤 Upload BRD File</Text>

      <TouchableOpacity onPress={pickFile} className="bg-indigo-500 p-3 rounded mb-4">
        <Text className="text-white text-center font-semibold">Choose File</Text>
      </TouchableOpacity>

      {file && <Text className="mb-2 text-sm">{file.name}</Text>}

      <TouchableOpacity
        onPress={handleUpload}
        disabled={!file || uploading}
        className={`p-3 rounded ${uploading ? 'bg-gray-400' : 'bg-green-600'}`}
      >
        <Text className="text-white text-center font-semibold">
          {uploading ? 'Uploading...' : 'Upload File'}
        </Text>
      </TouchableOpacity>

      {!!serverResponse && <Text className="mt-4 text-center">{serverResponse}</Text>}
    </View>
  );
}
