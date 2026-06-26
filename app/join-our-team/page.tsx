'use client';

import React from 'react';
import Navbar from '../components/Navbar';

export default function JoinOurTeam() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />

      {/* 1. Hero Section with promotional car image background */}
      <section 
        className="relative min-h-[620px] md:min-h-[680px] pt-24 md:pt-28 flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero-promo.jpg')" }}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/75"></div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white">
          <div className="inline-block px-4 py-1.5 bg-white/10 rounded-full text-xs tracking-[2px] mb-6 border border-white/20">
            NATIONWIDE TRANSPORTATION MARKETPLACE
          </div>

          <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter leading-none mb-6">
            Browse real trips.<br />Offer your services.<br />Drive with professional tools.
          </h1>

          <p className="max-w-2xl mx-auto text-2xl text-white/90 mb-10 tracking-tight">
            As a qualified independent driver, access trips posted by organizations. Submit offers, get approved, and complete work using live GPS, checklists, and geofence visibility.
          </p>

          <a 
            href="/sign-up?role=driver" 
            className="inline-flex items-center justify-center px-10 py-4 text-lg font-semibold bg-yellow-400 hover:bg-yellow-300 text-black rounded-2xl transition shadow-lg"
          >
            Apply to Join the Marketplace
          </a>
          <p className="mt-4 text-sm text-white/70">Background-checked, insured, and vehicle-inspected drivers welcome. Training and support provided.</p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs tracking-[2px]">
          SCROLL TO LEARN MORE ↓
        </div>
      </section>

      {/* 2. Partner with Safe Ride Network */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-blue-950 mb-6">
          Partner with Safe Ride Network
        </h2>
        <div className="max-w-3xl mx-auto">
          <p className="text-xl text-gray-900 leading-relaxed mb-8">
            Join the Safe Ride Network marketplace as a qualified independent driver. Browse trips posted by real organizations (schools, medical, senior services, courier), submit competitive offers, and complete work using professional tools including live GPS sharing, checklists, and geofence visibility.
          </p>
          <p className="text-xl text-gray-900 leading-relaxed mb-10">
            You control your schedule as a 1099 contractor while benefiting from established demand, operational support, and a transparent offer system. High-quality, background-checked drivers are always in demand.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
          {[
            { title: "Flexible Schedule", desc: "Choose the days and hours that fit your life. Morning and afternoon student routes available." },
            { title: "Competitive Pay", desc: "Earn $28+ per trip with weekly direct deposit. Most drivers complete 10–12 trips daily." },
            { title: "Real Support", desc: "Dedicated dispatch, GPS tracking tools, training, and route management provided by our team." }
          ].map((item, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-8">
              <div className="text-blue-800 text-2xl mb-4">✓</div>
              <h3 className="font-semibold text-xl text-gray-900 mb-3">{item.title}</h3>
              <p className="text-gray-900 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Opportunities Nationwide */}
      <section className="bg-zinc-50 py-16 border-y">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="uppercase text-blue-800 text-xs tracking-[2px] font-semibold mb-2">SCALE ACROSS THE UNITED STATES</div>
            <h2 className="text-4xl font-semibold tracking-tight text-gray-900">Opportunities Nationwide</h2>
          </div>

          <div className="max-w-3xl mx-auto text-center">
            <p className="text-lg text-gray-900 leading-relaxed mb-6">
              Trips are posted by organizations across the country — from student transportation and medical logistics to senior services and corporate mobility. 
              Drivers can browse and submit offers on routes that match their location, schedule, and vehicle.
            </p>
            <p className="text-sm text-gray-900">Whether you operate in major metros or regional areas, the marketplace connects you with real demand from coast to coast.</p>
          </div>
        </div>
      </section>

      {/* 4. Compensation Section - stands out with colored background */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-blue-900 text-white rounded-3xl px-10 py-16 md:px-16 md:py-20">
            <div className="text-center mb-10">
              <div className="uppercase tracking-[3px] text-blue-200 text-xs font-semibold mb-3">TRANSPARENT OFFERS • WEEKLY DEPOSITS</div>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">Compensation You Control Through Offers</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 text-center">
              <div>
                <div className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-1">$28</div>
                <div className="text-base sm:text-lg font-medium text-blue-100">for the first 0–12 miles</div>
              </div>
              <div>
                <div className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-1">$1.65</div>
                <div className="text-base sm:text-lg font-medium text-blue-100">per mile after 12 miles</div>
              </div>
              <div>
                <div className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-1">10-12</div>
                <div className="text-base sm:text-lg font-medium text-blue-100">trips per day for most drivers</div>
              </div>
              <div>
                <div className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-1">WEEKLY</div>
                <div className="text-base sm:text-lg font-medium text-blue-100">direct deposit pay</div>
              </div>
            </div>

            <div className="mt-12 text-center">
              <a 
                href="/sign-up?role=driver" 
                className="inline-flex items-center px-9 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold text-lg rounded-2xl transition"
              >
                Start Earning — Apply Now
              </a>
              <p className="mt-3 text-blue-200 text-sm">No hidden fees. Clear per-trip structure.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. How It Works */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-4xl font-semibold tracking-tight text-gray-900 mb-8 text-center">How It Works</h2>

        <div className="prose prose-lg max-w-none text-gray-900">
          <p className="text-xl mb-8">
            This is a <strong>1099 independent contractor</strong> opportunity within a real transportation marketplace. You control your schedule and vehicle. Organizations post specific trips; you browse, offer, and deliver using professional tools (live location, geofences, trails, and checklists). Safe Ride Network provides the platform, demand, and operational infrastructure.
          </p>
        </div>

        <div className="mt-8">
          <h3 className="font-semibold text-xl text-gray-900 mb-4">The Platform Provides:</h3>
          <ul className="grid md:grid-cols-2 gap-x-12 gap-y-3 text-gray-900 text-[15px]">
            <li className="flex gap-3">• Access to trips posted by real organizations</li>
            <li className="flex gap-3">• Real-time GPS, geofencing, and full trip trails</li>
            <li className="flex gap-3">• Driver execution tools and safety checklist</li>
            <li className="flex gap-3">• Onboarding training and dispatch support</li>
            <li className="flex gap-3">• Weekly direct deposit on completed work</li>
            <li className="flex gap-3">• Ratings &amp; reputation system to win more offers</li>
          </ul>
        </div>
      </section>

      {/* 6. Vehicle Requirements */}
      <section className="bg-zinc-50 border-y py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-semibold tracking-tight text-gray-900 mb-8 text-center">Vehicle Requirements</h2>
          <div className="max-w-2xl mx-auto">
            <ul className="space-y-4 text-lg text-gray-900">
              <li className="flex gap-4"><span className="text-blue-800 font-bold">•</span> 2012 model year or newer</li>
              <li className="flex gap-4"><span className="text-blue-800 font-bold">•</span> Excellent condition, well-maintained</li>
              <li className="flex gap-4"><span className="text-blue-800 font-bold">•</span> Four-door sedan or SUV (no trucks)</li>
              <li className="flex gap-4"><span className="text-blue-800 font-bold">•</span> Legal window tinting (35% or less)</li>
            </ul>
            <p className="mt-6 text-sm text-gray-900">Your vehicle will also need to pass a certified mechanic inspection as part of onboarding.</p>
          </div>
        </div>
      </section>

      {/* 7. Driver Requirements & Costs */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-4xl font-semibold tracking-tight text-gray-900 mb-8 text-center">Driver Requirements &amp; Costs</h2>

        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="font-semibold text-xl text-gray-900 mb-4">You must have / provide:</h3>
            <ul className="space-y-3 text-gray-900">
              <li>• Valid Driver’s License</li>
              <li>• Current Proof of Insurance</li>
              <li>• Current Vehicle Registration</li>
              <li>• Pass Background Check &amp; Fingerprinting</li>
              <li>• English Proficiency Assessment</li>
              <li>• Pass Drug Test</li>
              <li>• Complete EverDriven SafeRide Course</li>
              <li>• Vehicle Inspection by a Certified Mechanic</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-xl text-gray-900 mb-4">Costs (where applicable):</h3>
            <ul className="space-y-3 text-gray-900">
              <li>• Background check &amp; fingerprinting — typically $35–$60</li>
              <li>• Drug test — typically $40–$65</li>
              <li>• Vehicle inspection by certified mechanic — cost varies by shop</li>
              <li>• SafeRide training course — details provided during application</li>
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-gray-900">
              Many of these are one-time or low recurring costs. We’ll walk you through each step during the application and onboarding process.
            </p>
          </div>
        </div>
      </section>

      {/* 8. Final Call to Action */}
      <section className="bg-blue-900 text-white py-20">
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-semibold tracking-tight mb-4">Ready to offer your services in the marketplace?</h2>
          <p className="text-blue-100 text-lg mb-8">Browse real trips posted by organizations. Use professional tools. Build your reputation with ratings. Apply today.</p>
          
          <a 
            href="/sign-up?role=driver" 
            className="inline-flex items-center justify-center px-12 py-4 text-lg font-semibold bg-yellow-400 hover:bg-yellow-300 text-black rounded-2xl transition shadow-lg"
          >
            Apply to Drive Now
          </a>

          <div className="mt-8 text-sm text-blue-200">
            Questions? Call (316) 555-0192 or email dispatch@saferidenetwork.com • See <a href="/how-it-works#drivers" className="underline">How It Works for Drivers</a>
          </div>
        </div>
      </section>

    </div>
  );
}
