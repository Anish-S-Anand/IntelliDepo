"use client";

import Link from "next/link";
import { Briefcase, FileText, UserCheck, Zap } from "lucide-react";

export default function RecruitPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-12">
        <Link href="/platform" className="text-sm font-medium text-blue-600 hover:text-blue-700 mb-4 inline-block">
          ← Back to Platform
        </Link>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0f2356] mb-3">
          Recruit
        </h2>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl">
          Talent acquisition and HR management tools for recruitment, onboarding, and team building.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-6 sm:p-8">
          <div className="bg-purple-100 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 sm:w-7 sm:h-7 text-purple-700" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-purple-700 mb-2">
            Job Postings
          </h3>
          <p className="text-sm sm:text-base text-purple-600">
            Create and manage open positions and job descriptions.
          </p>
        </div>

        <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-6 sm:p-8">
          <div className="bg-purple-100 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-purple-700" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-purple-700 mb-2">
            Applications
          </h3>
          <p className="text-sm sm:text-base text-purple-600">
            Review and manage candidate applications.
          </p>
        </div>

        <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-6 sm:p-8">
          <div className="bg-purple-100 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center mb-4">
            <UserCheck className="w-6 h-6 sm:w-7 sm:h-7 text-purple-700" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-purple-700 mb-2">
            Onboarding
          </h3>
          <p className="text-sm sm:text-base text-purple-600">
            Streamline employee onboarding and integration.
          </p>
        </div>

        <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-6 sm:p-8">
          <div className="bg-purple-100 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-purple-700" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-purple-700 mb-2">
            Quick Actions
          </h3>
          <p className="text-sm sm:text-base text-purple-600">
            Automate common recruitment workflows.
          </p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="mt-12 p-6 sm:p-8 rounded-xl border-2 border-slate-300 bg-slate-50">
        <p className="text-center text-slate-700 font-medium">
          Recruit features are coming soon. Check back later for updates.
        </p>
      </div>
    </div>
  );
}
