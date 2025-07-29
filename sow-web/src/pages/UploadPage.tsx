import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBRDRuns } from '../hooks/useBRDRuns';
import { uploadBRDFile } from '../services/api';

export default function UploadPage() {
  const [templateId, setTemplateId] = useState('qtpZ3UaoZnwMF3frK9tJeg');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [serverResponse, setServerResponse] = useState('');

  const { data, isLoading, error } = useBRDRuns(templateId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const response = await uploadBRDFile(file);
      setServerResponse(response.message || 'Uploaded successfully!');
    } catch (err) {
      setServerResponse('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Upload BRD</h1>
      <input
        type="text"
        className="border p-2 w-full mb-4"
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
        placeholder="Enter Template ID"
      />
      <input
        type="file"
        onChange={handleFileChange}
        className="mb-4"
        accept=".pdf,.doc,.docx"
      />
      <button
        className={`w-full py-2 rounded text-white font-semibold ${
          uploading ? 'bg-gray-400' : 'bg-blue-600'
        }`}
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? 'Uploading...' : 'Upload File'}
      </button>

      {serverResponse && <p className="mt-2 text-sm text-center">{serverResponse}</p>}

      <div className="mt-6">
        <h2 className="font-semibold text-lg mb-2">BRD Runs</h2>
        {isLoading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">Error loading data</p>
        ) : (
          <ul className="space-y-2">
            {data?.map((item: any) => (
              <li key={item.id} className="border p-2 rounded">
                <Link to={`/run/${item.id}`} className="block">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500">{item.id}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
