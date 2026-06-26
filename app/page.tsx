'use client';

import React from 'react';
import Navbar from './components/Navbar';

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />

      {/* Hero — Professional Transportation Marketplace */}
      <section className="bg-gradient-to-br from-zinc-950 via-blue-950 to-zinc-950 text-white py-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-block px-4 py-1.5 bg-white/10 rounded-full text-xs tracking-widest mb-6 border border-white/20">
            NATIONWIDE PROFESSIONAL TRANSPORTATION MARKETPLACE
          </div>
          
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter leading-none mb-6">
            Connecting Organizations<br />with Qualified Drivers.
          </h1>
          
          <p className="max-w-2xl mx-auto text-xl text-blue-100 mb-10">
            A secure marketplace for schools, medical providers, and organizations to post transportation needs and for professional independent drivers to browse trips, submit offers, and deliver reliable service — backed by live GPS, geofencing, trails, and operational oversight.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/how-it-works#organizations" 
              className="px-8 py-4 rounded-2xl bg-white text-[#1E3A8A] font-semibold text-lg hover:bg-blue-50 transition"
            >
              For Organizations — Post Trips
            </a>
            <a 
              href="/apply-to-drive" 
              className="px-8 py-4 rounded-2xl border border-white/70 text-white font-semibold text-lg hover:bg-white/10 transition"
            >
              For Drivers — Get Started
            </a>
          </div>
          <div className="mt-4">
            <a href="/how-it-works" className="text-sm text-blue-200 hover:text-white underline underline-offset-4">Learn exactly how the marketplace works →</a>
          </div>
        </div>
      </section>

      {/* Trust Bar — Marketplace + Operational Strength */}
      <div className="border-b py-4 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-blue-950 text-center font-medium">
          <div>Real-time GPS + Geofencing</div>
          <div>Verified Driver Ratings</div>
          <div>Historical Trip Trails</div>
          <div>Admin Live Monitoring</div>
          <div>Role-Based Secure Portals</div>
        </div>
      </div>

      {/* Platform Positioning — Two-Sided Marketplace */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="text-4xl font-semibold tracking-tight mb-4 text-blue-950">A professional marketplace for reliable transportation.</h2>
          <p className="text-xl text-blue-900">
            Organizations post specific trips with clear requirements. Qualified drivers browse open opportunities and submit competitive offers. 
            Once assigned, both parties benefit from live operational tools that deliver accountability and peace of mind.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="border border-blue-200 rounded-3xl p-8 bg-white">
            <div className="uppercase text-xs tracking-widest font-semibold text-blue-800 mb-2">FOR ORGANIZATIONS</div>
            <div className="font-semibold text-xl text-blue-950 mb-3">Post. Review. Monitor.</div>
            <p className="text-blue-900">Schools, clinics, senior services and other groups source vetted drivers for student routes, NEMT, courier, and more. Approve offers and watch progress with geofence alerts and full trip trails.</p>
            <a href="/how-it-works#organizations" className="inline-block mt-4 text-sm font-semibold text-[#1E3A8A] hover:underline">How organizations use the platform →</a>
          </div>
          <div className="border border-blue-200 rounded-3xl p-8 bg-white">
            <div className="uppercase text-xs tracking-widest font-semibold text-blue-800 mb-2">FOR DRIVERS</div>
            <div className="font-semibold text-xl text-blue-950 mb-3">Browse. Offer. Deliver.</div>
            <p className="text-blue-900">Independent contractors control their schedule. View real trips, submit offers, and complete work using professional driver tools including live location sharing and pre-trip safety checklists.</p>
            <a href="/how-it-works#drivers" className="inline-block mt-4 text-sm font-semibold text-[#1E3A8A] hover:underline">How drivers succeed on the platform →</a>
          </div>
        </div>
      </section>

      {/* Transportation Categories — Marketplace Opportunities */}
      <section id="services" className="bg-blue-50 py-16 border-t">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="uppercase text-blue-800 text-sm tracking-[2px] font-semibold mb-3">TRIP TYPES IN THE MARKETPLACE</div>
            <h2 className="text-5xl font-semibold tracking-tight text-blue-950">Transportation Organizations Need</h2>
            <p className="mt-3 text-blue-950 max-w-lg mx-auto">Organizations post trips across these categories. Drivers browse and offer their services on the trips that match their availability and vehicle capabilities.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { 
                title: "Student Transportation", 
                desc: "Recurring or one-off school routes. Rigorously qualified drivers with real-time GPS visibility for schools and families." 
              },
              { 
                title: "Non-Emergency Medical (NEMT)", 
                desc: "Reliable transport to medical appointments. Wheelchair-accessible options and trained drivers available through the platform." 
              },
              { 
                title: "Elderly & Accessible Rides", 
                desc: "Compassionate door-to-door service supporting independence. Organizations coordinate recurring or as-needed senior mobility." 
              },
              { 
                title: "Medical Courier & Logistics", 
                desc: "Secure, tracked delivery of specimens, supplies, and records. Strict handling with full trail and geofence accountability." 
              },
              { 
                title: "General & Group Transport", 
                desc: "Work commutes, events, group outings, or ad-hoc needs. Organizations source reliable capacity through competitive offers." 
              }
            ].map((service, index) => (
              <div key={index} className="bg-white border border-blue-200 p-8 rounded-3xl hover:shadow-sm transition">
                <h3 className="font-semibold text-2xl tracking-tight mb-3 text-blue-950">{service.title}</h3>
                <p className="text-blue-900 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-sm mt-8 text-blue-800">Primary users are organizations posting structured trips. Individuals may also request services via our request form.</p>
        </div>
      </section>

      {/* Why Organizations & Drivers Choose the Platform */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <div className="uppercase text-blue-800 text-xs tracking-[2px] font-semibold mb-2">WHY THE MARKETPLACE DELIVERS BETTER RESULTS</div>
          <h2 className="text-4xl font-semibold tracking-tight text-blue-950">Visibility, accountability, and qualified matches.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            "Qualified drivers with documented credentials, vehicle standards, and verified ratings",
            "Live operational visibility — GPS, geofence zone alerts, and complete historical trails for every trip",
            "Transparent offer process + post-trip reviews create accountability on both sides of the marketplace"
          ].map((point, i) => (
            <div key={i} className="bg-white border border-blue-200 rounded-3xl p-8">
              <div className="text-[#1E40AF] text-3xl mb-4">✓</div>
              <p className="font-semibold leading-tight text-lg text-blue-950">{point}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof — Marketplace Perspective */}
      <section className="bg-blue-50 border-y py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="text-blue-800 text-xs tracking-widest font-semibold">ORGANIZATIONS &amp; DRIVERS RELY ON THE PLATFORM</div>
            <h3 className="text-3xl font-semibold tracking-tight mt-2 text-blue-950">Clear process. Real accountability. Better matches.</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: "We post recurring student routes and receive quality offers quickly. The live map and geofence alerts give us confidence every day.", name: "Transportation Coordinator, Local School District" },
              { quote: "As a driver I browse real trips instead of hoping for calls. I submit offers, get approved, and complete work with professional tracking tools.", name: "Michael R., Independent Driver" },
              { quote: "The combination of offer transparency + post-trip reviews has raised the quality of drivers we work with. Full trail history is invaluable for compliance.", name: "Operations Lead, Regional Medical Provider" }
            ].map((t, i) => (
              <div key={i} className="bg-white p-7 rounded-3xl border text-sm">
                <p className="text-blue-950">“{t.quote}”</p>
                <div className="mt-4 text-xs text-blue-950">— {t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA — Clear Dual Audience */}
      <section id="apply" className="py-20 bg-white border-t">
        <div className="max-w-3xl mx-auto text-center px-6">
          <h2 className="text-4xl font-semibold tracking-tight mb-3 text-blue-950">Ready to participate in the marketplace?</h2>
          <p className="text-blue-900 mb-8 max-w-xl mx-auto">Organizations: Post your transportation needs and monitor execution. Drivers: Browse open trips and offer your services with professional-grade tools.</p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/how-it-works#organizations" className="px-8 py-3.5 bg-[#1E3A8A] text-white rounded-2xl font-semibold hover:bg-blue-900 transition">
              For Organizations — Post Trips
            </a>
            <a href="/apply-to-drive" className="px-8 py-3.5 border border-blue-200 rounded-2xl font-semibold text-blue-950 hover:bg-blue-50 transition">
              For Drivers — Get Started
            </a>
          </div>
          <div className="mt-4 text-sm">
            <a href="/sign-up" className="text-blue-800 hover:underline font-medium">Create an account (choose Organization or Driver at signup)</a>
          </div>
        </div>
      </section>

      {/* Contact / Support */}
      <section id="contact" className="border-t py-16 bg-blue-50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-sm uppercase tracking-widest text-blue-800 mb-3">PLATFORM SUPPORT</div>
          <h3 className="text-3xl font-semibold tracking-tight mb-6 text-blue-950">Questions about posting trips or offering services?</h3>
          
          <div className="flex flex-col sm:flex-row justify-center gap-x-10 gap-y-2 text-sm text-blue-900">
            <div>(316) 555-0192</div>
            <div>dispatch@saferidenetwork.com</div>
            <div>Nationwide — United States</div>
          </div>
          <p className="mt-6 text-xs text-blue-700">For urgent operational matters during active trips, use the portals for fastest response.</p>
        </div>
      </section>

    </div>
  );
}
