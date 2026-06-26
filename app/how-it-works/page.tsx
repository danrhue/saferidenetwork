'use client';

import React from 'react';
import Navbar from '../components/Navbar';
import Link from 'next/link';

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="bg-blue-950 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline px-3 py-1 text-xs tracking-[2px] bg-white/10 rounded-full border border-white/20 mb-4">
            NATIONWIDE PROFESSIONAL TRANSPORTATION MARKETPLACE
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter mb-4">How Safe Ride Network Works</h1>
          <p className="max-w-2xl mx-auto text-xl text-blue-100">
            A secure, nationwide two-sided marketplace that connects organizations across the United States needing reliable transportation with qualified independent drivers — 
            powered by real-time GPS tracking, geofencing, historical trails, and operational oversight.
          </p>
        </div>
      </section>

      {/* Quick Audience Switcher */}
      <div className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap gap-3 text-sm">
          <a href="#organizations" className="px-4 py-2 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 font-medium text-blue-950">For Organizations</a>
          <a href="#drivers" className="px-4 py-2 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 font-medium text-blue-950">For Drivers</a>
          <a href="#riders" className="px-4 py-2 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 font-medium text-blue-950">For Riders</a>
          <a href="#tools" className="px-4 py-2 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 font-medium text-blue-950">Advanced Operational Tools</a>
        </div>
      </div>

      {/* For Organizations */}
      <section id="organizations" className="max-w-5xl mx-auto px-6 py-16 scroll-mt-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="uppercase tracking-[2px] text-xs font-semibold text-blue-800">ORGANIZATIONS &amp; COORDINATORS</div>
        </div>
        <h2 className="text-4xl font-semibold tracking-tight text-blue-950 mb-4">Post trips. Receive offers. Monitor in real time.</h2>
        <p className="text-lg text-blue-900 max-w-3xl mb-10">
          Schools, medical providers, senior services, and organizations across the United States use Safe Ride Network to source reliable transportation on demand or for recurring routes. 
          Post detailed trips, review competitive offers from qualified drivers anywhere in the country, approve assignments, and maintain full visibility through live operations tools.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: "1", title: "Post a Trip", desc: "Provide pickup, dropoff, time, passenger needs, and any special requirements. Our pricing engine helps suggest fair compensation." },
            { step: "2", title: "Review Offers", desc: "Qualified drivers browse your trip and submit offers. Compare driver profiles, ratings, and proposed terms in one place." },
            { step: "3", title: "Approve & Monitor", desc: "Select the best offer. Track the trip live with GPS, historical trail, geofence alerts (pickup/dropoff zones), and completion status." }
          ].map((item, i) => (
            <div key={i} className="bg-white border border-blue-200 rounded-3xl p-8">
              <div className="text-blue-800 text-sm font-semibold tracking-widest mb-3">STEP {item.step}</div>
              <h3 className="font-semibold text-2xl tracking-tight text-blue-950 mb-3">{item.title}</h3>
              <p className="text-blue-900">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link href="/sign-up" className="inline-flex px-6 py-3 bg-[#1E3A8A] text-white rounded-2xl font-semibold text-sm hover:bg-blue-900 transition">Sign Up as an Organization →</Link>
          <Link href="/login" className="ml-4 text-sm text-blue-800 hover:underline font-medium">Or log in to Organization Portal</Link>
        </div>
      </section>

      {/* For Drivers */}
      <section id="drivers" className="bg-blue-50 border-y py-16 scroll-mt-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="uppercase tracking-[2px] text-xs font-semibold text-blue-800">INDEPENDENT DRIVERS</div>
          </div>
          <h2 className="text-4xl font-semibold tracking-tight text-blue-950 mb-4">Browse real trips. Submit offers. Execute with professional tools.</h2>
          <p className="text-lg text-blue-900 max-w-3xl mb-10">
            As a qualified independent contractor, you control your schedule. Browse open trips posted by real organizations across the United States — student transport, NEMT, elderly services, courier, and more. 
            Submit competitive offers, get approved, and complete trips using the same operational-grade tools administrators rely on.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Browse the Marketplace", desc: "View available trips with full details — locations, timing, passengers, and compensation parameters. Filter by area and type." },
              { step: "2", title: "Submit Your Offer", desc: "Propose your terms and availability. Organizations review profiles, past performance, and ratings before approving." },
              { step: "3", title: "Complete with Confidence", desc: "Use the driver execution screen: pre-trip checklist, live location sharing, automatic trail recording, and geofence status for pickup and dropoff zones." }
            ].map((item, i) => (
              <div key={i} className="bg-white border border-blue-200 rounded-3xl p-8">
                <div className="text-blue-800 text-sm font-semibold tracking-widest mb-3">STEP {item.step}</div>
                <h3 className="font-semibold text-2xl tracking-tight text-blue-950 mb-3">{item.title}</h3>
                <p className="text-blue-900">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 items-center">
            <Link href="/sign-up?role=driver" className="inline-flex px-6 py-3 bg-[#1E3A8A] text-white rounded-2xl font-semibold text-sm hover:bg-blue-900 transition">Get Started — Sign Up as Driver</Link>
            <Link href="/apply-to-drive" className="inline-flex px-6 py-3 border border-blue-300 rounded-2xl font-semibold text-sm text-blue-950 hover:bg-white">How Driver Onboarding Works</Link>
            <Link href="/login" className="text-sm text-blue-800 hover:underline font-medium ml-2">Driver Portal Login</Link>
          </div>
        </div>
      </section>

      {/* For Riders */}
      <section id="riders" className="max-w-5xl mx-auto px-6 py-16 scroll-mt-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="uppercase tracking-[2px] text-xs font-semibold text-blue-800">INDIVIDUAL RIDERS</div>
        </div>
        <h2 className="text-4xl font-semibold tracking-tight text-blue-950 mb-4">Request a personal ride. Get matched. Track your trip.</h2>
        <p className="text-lg text-blue-900 max-w-3xl mb-10">
          Need transportation for yourself or family? Safe Ride Network connects individual riders with vetted
          independent drivers — with transparent pricing, secure payment, and real-time trip updates from request
          through completion.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Request a Ride', desc: 'Enter pickup, drop-off, schedule, and any accessibility needs. Review pricing and policy before checkout.' },
            { step: '2', title: 'Get Matched', desc: 'Choose auto-match for fast assignment or review driver offers manually. Confirm your driver within the confirmation window.' },
            { step: '3', title: 'Ride & Review', desc: 'Track your trip live, receive status updates, and rate your driver when the ride is complete.' },
          ].map((item, i) => (
            <div key={i} className="bg-white border border-blue-200 rounded-3xl p-8">
              <div className="text-blue-800 text-sm font-semibold tracking-widest mb-3">STEP {item.step}</div>
              <h3 className="font-semibold text-2xl tracking-tight text-blue-950 mb-3">{item.title}</h3>
              <p className="text-blue-900">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 items-center">
          <Link href="/get-a-ride" className="inline-flex px-6 py-3 bg-[#1E3A8A] text-white rounded-2xl font-semibold text-sm hover:bg-blue-900 transition">Get a Ride →</Link>
          <Link href="/sign-up?role=rider" className="inline-flex px-6 py-3 border border-blue-300 rounded-2xl font-semibold text-sm text-blue-950 hover:bg-white">Create Rider Account</Link>
          <Link href="/login" className="text-sm text-blue-800 hover:underline font-medium ml-2">Rider Portal Login</Link>
        </div>
      </section>

      {/* Advanced Tools */}
      <section id="tools" className="bg-blue-50 border-y py-16 scroll-mt-10">
        <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="uppercase text-blue-800 text-xs tracking-[2px] font-semibold mb-2">BUILT FOR SERIOUS OPERATIONS</div>
          <h2 className="text-4xl font-semibold tracking-tight text-blue-950">Advanced platform capabilities</h2>
          <p className="mt-3 text-blue-900 max-w-md mx-auto">The same professional-grade tools used by our admin team are available to organizations and drivers for accountability and safety.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {[
            { title: "Real-Time GPS Tracking", desc: "Live driver location updates on every active trip. Organizations and admins see precise position and movement history." },
            { title: "Historical Trip Trails", desc: "Douglas-Peucker simplified paths with directional arrows and recency highlighting. Full audit trail of the journey." },
            { title: "Real-Time Geofencing", desc: "Automatic circular zones around pickup and dropoff locations. Instant alerts when a driver enters or exits a zone — visible to organizations and admins." },
            { title: "Ratings & Reviews", desc: "Post-trip reviews from organizations build driver reputation. Low ratings require explanation. Trust and quality are visible in the marketplace." },
            { title: "Admin Live Monitoring", desc: "Platform-wide oversight with clustered map views, live status, duration timers, and geofence event history for every active trip." },
            { title: "Secure Role-Based Access", desc: "Drivers, organizations, and administrators each see only what they need through protected portals and real-time Supabase channels." }
          ].map((feat, idx) => (
            <div key={idx} className="border border-blue-200 rounded-3xl p-8 bg-white">
              <h3 className="font-semibold text-xl tracking-tight text-blue-950 mb-2">{feat.title}</h3>
              <p className="text-blue-900 text-[15px] leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-blue-950 text-white py-16 border-t border-blue-900">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">Ready to get started?</h2>
          <p className="text-blue-100 mb-8">Whether you need to arrange reliable transportation or want to offer your services as a qualified driver, the platform is built for clarity and professionalism.</p>

          <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
            <Link href="/get-a-ride" className="px-8 py-3.5 rounded-2xl bg-white text-[#1E3A8A] font-semibold hover:bg-blue-50 transition">Get a Ride</Link>
            <Link href="/sign-up" className="px-8 py-3.5 rounded-2xl border border-white/70 font-semibold hover:bg-white/10 transition">Create an Account</Link>
            <Link href="/login" className="px-8 py-3.5 rounded-2xl border border-white/70 font-semibold hover:bg-white/10 transition">Log In to Portal</Link>
            <Link href="/apply-to-drive" className="px-8 py-3.5 rounded-2xl border border-white/70 font-semibold hover:bg-white/10 transition">Explore Driver Opportunities</Link>
          </div>
          <p className="mt-6 text-xs text-blue-300">All accounts require email confirmation. Role selection happens at signup (Driver or Organization).</p>
        </div>
      </section>

    </div>
  );
}
