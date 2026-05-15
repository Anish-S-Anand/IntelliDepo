"use client";

import Link from "next/link";
import { Users, MessageSquare, Coffee, Calendar } from "lucide-react";

export default function CafePage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-12">
        <Link href="/platform" className="text-sm font-medium text-blue-600 hover:text-blue-700 mb-4 inline-block">
          ← Back to Platform
        </Link>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0f2356] mb-3">
          Cafe
        </h2>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl">
          Employee engagement and collaboration space for team communication and knowledge sharing.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 sm:p-8">
          <div className="bg-green-100 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 text-green-700" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-green-700 mb-2">
            Team Chat
          </h3>
          <p className="text-sm sm:text-base text-green-600">
            Real-time messaging and collaboration for team members.
          </p>
        </div>

        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 sm:p-8">
          <div className="bg-green-100 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center mb-4">
            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-green-700" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-green-700 mb-2">
            Teams
          </h3>
          <p className="text-sm sm:text-base text-green-600">
            Organize and manage team groups and departments.
          </p>
        </div>

        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 sm:p-8">
          <div className="bg-green-100 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center mb-4">
            <Coffee className="w-6 h-6 sm:w-7 sm:h-7 text-green-700" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-green-700 mb-2">
            Events
          </h3>
          <p className="text-sm sm:text-base text-green-600">
            Discover and participate in company events and activities.
          </p>
        </div>

        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 sm:p-8">
          <div className="bg-green-100 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center mb-4">
            <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-green-700" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-green-700 mb-2">
            Calendar
          </h3>
          <p className="text-sm sm:text-base text-green-600">
            Manage team schedules and meetings.
          </p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="mt-12 p-6 sm:p-8 rounded-xl border-2 border-slate-300 bg-slate-50">
        <p className="text-center text-slate-700 font-medium">
          Cafe features are coming soon. Check back later for updates.
        </p>
      </div>
    </div>
  );
}
