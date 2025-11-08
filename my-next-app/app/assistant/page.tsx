"use client";
import AssistantPanel from "../components/AssistantPanel";

export default function AssistantPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <AssistantPanel inline={true} sessionId={null} />
      </div>
    </div>
  );
}
