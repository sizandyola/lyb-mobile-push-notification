'use client';

import { useState, useEffect } from 'react';

interface ErrorLog {
  id: string;
  tokenId: string | null;
  platform: string | null;
  errorType: string;
  message: string;
  stackTrace: string | null;
  context: any;
  appVersion: string | null;
  createdAt: string;
}

interface ErrorStats {
  total: number;
  errorTypes: { type: string; count: number }[];
}

export default function ErrorLogsAdmin() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [filterPlatform, setFilterPlatform] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [filterType, filterPlatform]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('errorType', filterType);
      if (filterPlatform) params.append('platform', filterPlatform);

      const response = await fetch(`/api/logs/error?${params}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Error Logs
          </h1>
          <button
            onClick={fetchLogs}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Statistics Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Statistics</h2>
          {loading ? (
            <p className="text-gray-500">Loading statistics...</p>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-sm text-red-600 font-medium">Total Errors</p>
                <p className="text-3xl font-bold text-red-900">{stats.total}</p>
              </div>
              {stats.errorTypes.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-600 font-medium mb-2">Error Types</p>
                  <div className="space-y-1">
                    {stats.errorTypes.map(et => (
                      <div key={et.type} className="flex justify-between">
                        <span className="text-gray-700">{et.type}</span>
                        <span className="font-bold text-gray-900">{et.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-red-500">Failed to load statistics</p>
          )}
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-2 text-gray-700">Error Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">All Types</option>
                {stats?.errorTypes.map(et => (
                  <option key={et.type} value={et.type}>{et.type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-2 text-gray-700">Platform</label>
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">All Platforms</option>
                <option value="ios">iOS</option>
                <option value="android">Android</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Logs Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Recent Errors</h2>
          </div>

          {loading ? (
            <div className="p-6">
              <p className="text-gray-500">Loading error logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-6">
              <p className="text-gray-500">No error logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      App Version
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          {log.errorType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.platform || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                        {log.message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.appVersion || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal for Error Details */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">Error Details</h3>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                  >
                    &times;
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Error Type</label>
                    <p className="text-gray-900 bg-gray-50 p-2 rounded">{selectedLog.errorType}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <p className="text-gray-900 bg-gray-50 p-2 rounded">{selectedLog.message}</p>
                  </div>

                  {selectedLog.stackTrace && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stack Trace</label>
                      <pre className="text-xs text-gray-900 bg-gray-50 p-4 rounded overflow-x-auto">
                        {selectedLog.stackTrace}
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                      <p className="text-gray-900 bg-gray-50 p-2 rounded">{selectedLog.platform || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">App Version</label>
                      <p className="text-gray-900 bg-gray-50 p-2 rounded">{selectedLog.appVersion || '-'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <p className="text-gray-900 bg-gray-50 p-2 rounded">{formatDate(selectedLog.createdAt)}</p>
                  </div>

                  {selectedLog.context && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Context</label>
                      <pre className="text-xs text-gray-900 bg-gray-50 p-4 rounded overflow-x-auto">
                        {JSON.stringify(selectedLog.context, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedLog.tokenId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Token ID</label>
                      <p className="text-gray-900 bg-gray-50 p-2 rounded font-mono text-xs">{selectedLog.tokenId}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
