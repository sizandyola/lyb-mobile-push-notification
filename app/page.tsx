"use client";

import { useState, useEffect } from "react";

interface Stats {
  totalActiveTokens: number;
  totalInactiveTokens: number;
  platformBreakdown: { platform: string; count: number }[];
  notificationsSent24h: number;
  totalNotificationsSent: number;
}

export default function Home() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch("/api/notifications/stats");
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const sendNotification = async () => {
    setLoading(true);
    setResult(null);

    try {
      const payload = {
        title,
        body,
        data: {
          sentFrom: "admin-dashboard",
          timestamp: new Date().toISOString(),
        },
      };

      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setResult(data);

      // Refresh stats after sending
      if (data.success) {
        await fetchStats();
      }
    } catch (error) {
      setResult({ error: "Failed to send notification" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">
          Push Notification Admin
        </h1>

        {/* Statistics Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            Statistics
          </h2>
          {loadingStats ? (
            <p className="text-gray-500">Loading statistics...</p>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-600 font-medium">
                  Active Tokens
                </p>
                <p className="text-3xl font-bold text-blue-900">
                  {stats.totalActiveTokens}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-600 font-medium">Sent (24h)</p>
                <p className="text-3xl font-bold text-green-900">
                  {stats.notificationsSent24h}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-purple-600 font-medium">
                  Total Sent
                </p>
                <p className="text-3xl font-bold text-purple-900">
                  {stats.totalNotificationsSent}
                </p>
              </div>
              {stats.platformBreakdown.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 md:col-span-3">
                  <p className="text-sm text-gray-600 font-medium mb-2">
                    Platform Breakdown
                  </p>
                  <div className="flex gap-4">
                    {stats.platformBreakdown.map((p) => (
                      <div key={p.platform} className="flex items-center gap-2">
                        <span className="capitalize text-gray-700">
                          {p.platform}:
                        </span>
                        <span className="font-bold text-gray-900">
                          {p.count}
                        </span>
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

        {/* Send Notification Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">
            Send Broadcast Notification
          </h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block font-medium mb-2 text-gray-700">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Notification title"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block font-medium mb-2 text-gray-700">
                Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Notification message"
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                This will send a notification to all{" "}
                <strong>{stats?.totalActiveTokens || 0}</strong> active devices.
              </p>
            </div>

            {/* Send Button */}
            <button
              onClick={sendNotification}
              disabled={loading || !title || !body}
              className="w-full bg-blue-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Sending..." : "Send Notification"}
            </button>

            {/* Result */}
            {result && (
              <div
                className={`p-4 rounded-lg ${
                  result.success
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <h3
                  className={`font-semibold mb-2 ${
                    result.success ? "text-green-900" : "text-red-900"
                  }`}
                >
                  {result.success ? "Success!" : "Error"}
                </h3>
                <pre
                  className={`text-sm overflow-auto ${
                    result.success ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* <div className="bg-white rounded-lg shadow-md p-6 mt-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">API Endpoints</h2>
          <div className="space-y-3 text-sm">
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <p className="font-mono font-bold text-gray-900">POST /api/notifications/register-token</p>
              <p className="text-gray-600">Register a new push token from mobile app</p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4 py-2">
              <p className="font-mono font-bold text-gray-900">POST /api/notifications/unregister-token</p>
              <p className="text-gray-600">Unregister/deactivate a push token</p>
            </div>
            <div className="border-l-4 border-green-500 pl-4 py-2">
              <p className="font-mono font-bold text-gray-900">POST /api/notifications/send</p>
              <p className="text-gray-600">Send notification to all active tokens</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4 py-2">
              <p className="font-mono font-bold text-gray-900">GET /api/notifications/stats</p>
              <p className="text-gray-600">Get notification statistics</p>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
