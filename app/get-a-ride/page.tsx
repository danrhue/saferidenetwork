'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { saveRiderTripDraft } from '@/lib/rider/trip-draft';
import Navbar from '../components/Navbar';

// Phase 2: Persist anonymous leads to Supabase; funnel analytics events

const labelClass = 'block text-sm font-semibold text-blue-950 mb-2';

const inputClass =
  'w-full rounded-xl border-2 border-blue-300 bg-white px-4 py-3 text-blue-950 placeholder:text-blue-400 transition-colors duration-150 hover:border-blue-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/25';

const selectClass =
  'w-full rounded-xl border-2 border-blue-300 bg-white px-4 py-3 text-blue-950 transition-colors duration-150 hover:border-blue-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/25';

const textareaClass = `${inputClass} resize-y min-h-[120px]`;

const submitButtonClass =
  'w-full mt-4 rounded-2xl bg-gradient-to-b from-[#2563EB] to-[#1E3A8A] py-4 text-lg font-semibold text-white shadow-md transition-all duration-200 hover:from-[#3B82F6] hover:to-[#1E40AF] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:ring-offset-2 active:scale-[0.99]';

const TRUST_SIGNALS = [
  { icon: '✓', title: 'Vetted drivers', desc: 'Background-checked, document-verified professionals' },
  { icon: '◎', title: 'Live trip tracking', desc: 'Know when your driver is assigned and en route' },
  { icon: '🔒', title: 'Secure payments', desc: 'Pay safely through Stripe with clear cancel policy' },
];

type FormData = {
  name: string;
  phone: string;
  email: string;
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  passengers: string;
  notes: string;
};

export default function GetARide() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showCta, setShowCta] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    email: '',
    pickup: '',
    dropoff: '',
    date: '',
    time: '',
    passengers: '1',
    notes: '',
  });

  // Logged-in riders skip the funnel and go straight to the wizard (draft pre-fills there)
  useEffect(() => {
    const checkRiderSession = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'rider') {
          router.replace('/rider/trips/new');
        }
      } finally {
        setCheckingAuth(false);
      }
    };

    checkRiderSession();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    saveRiderTripDraft({
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      pickup: formData.pickup,
      dropoff: formData.dropoff,
      date: formData.date,
      time: formData.time,
      passengers: formData.passengers,
      notes: formData.notes,
    });

    setShowCta(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-blue-800">Loading...</p>
      </div>
    );
  }

  if (showCta) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />

        <div className="mx-auto max-w-xl px-6 py-16 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-3xl text-green-600">✓</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-blue-950 sm:text-4xl">
            Almost there, {formData.name.split(' ')[0] || 'friend'}!
          </h1>
          <p className="mt-4 text-lg text-blue-900">
            Create a free account to get matched with a vetted driver and pay securely.
          </p>
          <p className="mt-2 text-sm text-blue-800">
            Your trip details are saved — we&apos;ll pre-fill them after you sign up.
          </p>

          <div className="mt-8 space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 text-left text-sm">
            <p>
              <span className="font-semibold text-blue-950">Route:</span>{' '}
              {formData.pickup} → {formData.dropoff}
            </p>
            <p>
              <span className="font-semibold text-blue-950">When:</span> {formData.date} at {formData.time}
            </p>
            <p>
              <span className="font-semibold text-blue-950">Passengers:</span> {formData.passengers}
            </p>
          </div>

          <Link
            href="/sign-up?role=rider"
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#2563EB] to-[#1E3A8A] px-8 py-4 text-lg font-semibold text-white shadow-md transition hover:from-[#3B82F6] hover:to-[#1E40AF]"
          >
            Create a free account to confirm your ride
          </Link>

          <p className="mt-4 text-sm text-blue-800">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-[#1E3A8A] hover:underline">
              Log in
            </Link>
          </p>

          <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
            {TRUST_SIGNALS.map((signal) => (
              <div key={signal.title} className="rounded-xl border border-blue-100 bg-white p-4">
                <p className="text-lg">{signal.icon}</p>
                <p className="mt-1 text-sm font-semibold text-blue-950">{signal.title}</p>
                <p className="mt-1 text-xs text-blue-800">{signal.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-10">
          <div className="mb-2 text-xs font-semibold tracking-[2px] text-[#1E3A8A]">GET A RIDE</div>
          <h1 className="text-4xl font-semibold tracking-tighter text-blue-950 sm:text-5xl">
            Request a personal ride
          </h1>
          <p className="mt-3 text-lg text-blue-900 sm:text-xl">
            Tell us where you need to go. Create a free Rider account to get matched with a vetted driver and pay
            securely.
          </p>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {TRUST_SIGNALS.map((signal) => (
            <div key={signal.title} className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3">
              <p className="text-sm font-semibold text-blue-950">{signal.title}</p>
              <p className="mt-0.5 text-xs text-blue-800">{signal.desc}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-blue-100 bg-blue-50/30 p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={labelClass}>
                Full Name
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                autoComplete="name"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                autoComplete="tel"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="pickup" className={labelClass}>
                Pickup Location
              </label>
              <input
                id="pickup"
                type="text"
                name="pickup"
                value={formData.pickup}
                onChange={handleChange}
                required
                placeholder="123 Main St, City, ST"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="dropoff" className={labelClass}>
                Drop-off Location
              </label>
              <input
                id="dropoff"
                type="text"
                name="dropoff"
                value={formData.dropoff}
                onChange={handleChange}
                required
                placeholder="456 Oak Ave, City, ST"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label htmlFor="date" className={labelClass}>
                Date
              </label>
              <input
                id="date"
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="time" className={labelClass}>
                Time
              </label>
              <input
                id="time"
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="passengers" className={labelClass}>
                Passengers
              </label>
              <select
                id="passengers"
                name="passengers"
                value={formData.passengers}
                onChange={handleChange}
                className={selectClass}
              >
                <option value="1">1 passenger</option>
                <option value="2">2 passengers</option>
                <option value="3">3 passengers</option>
                <option value="4">4 passengers</option>
                <option value="5+">5+ passengers</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className={labelClass}>
              Special Requests or Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Wheelchair accessible? Child seat needed? Any other details..."
              className={textareaClass}
            />
          </div>

          <button type="submit" className={submitButtonClass}>
            Continue — save my trip details
          </button>

          <p className="mt-2 text-center text-sm text-blue-800">
            Next step: create a free Rider account. No trip is booked until you review pricing and pay in the portal.
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-blue-800">
          Need recurring organizational transportation?{' '}
          <Link href="/sign-up?role=organization" className="font-medium text-[#1E3A8A] hover:underline">
            Sign up as an Organization
          </Link>
        </p>
      </div>

      <footer className="border-t py-8 text-center text-sm text-blue-900">
        © {new Date().getFullYear()} Safe Ride Network • Nationwide Professional Transportation Marketplace
      </footer>
    </div>
  );
}