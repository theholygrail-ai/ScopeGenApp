import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-4">\u{1F3E0} Home Page</h1>
      <Link
        to="/upload"
        className="bg-blue-600 text-white font-semibold px-4 py-2 rounded"
      >
        Upload BRD
      </Link>
    </div>
  );
}
