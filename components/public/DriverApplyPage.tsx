'use client';

import Link from 'next/link';
import Navbar from '@/app/components/Navbar';

import FaqAccordion, { type FaqItem } from '@/components/public/FaqAccordion';
import { getDefaultRequiredDocuments } from '@/lib/driver/resolve-driver-documents';
import { formatDocumentValidity } from '@/lib/driver/required-documents';

const defaultDriverDocuments = getDefaultRequiredDocuments();

const SIGN_UP_DRIVER = '/sign-up?role=driver';
const DRIVER_PORTAL = '/login';

/* ── Content ── */

const twoSteps = [
  {
    number: '1',
    title: 'Create Your Driver Account',
    description:
      'Sign up in under two minutes. Select Driver at registration — no paper application, no phone screens, no waiting on callbacks.',
    cta: 'Create Account',
    href: SIGN_UP_DRIVER,
  },
  {
    number: '2',
    title: 'Upload Documents in Your Portal',
    description:
      'Open the Driver Portal, upload your required documents, and track approval status in real time. Once eligible, browse trips and submit offers.',
    cta: 'Go to Driver Portal',
    href: DRIVER_PORTAL,
  },
];

const benefits = [
  {
    title: 'Set Your Own Schedule',
    description:
      'Accept trips that fit your life. Morning routes, afternoon runs, or regional work — you choose when and where you drive.',
    icon: CalendarIcon,
  },
  {
    title: 'Nationwide Trip Marketplace',
    description:
      'Real demand from schools, medical providers, senior services, and organizations posting trips across the United States.',
    icon: MapIcon,
  },
  {
    title: 'Transparent Earnings',
    description:
      'See trip details and compensation before you submit an offer. No surprises — you know what you are agreeing to upfront.',
    icon: EarningsIcon,
  },
  {
    title: 'Professional Driver Tools',
    description:
      'Live GPS sharing, pre-trip checklists, geofence alerts, and trip history — operational-grade tools built for reliability.',
    icon: ToolsIcon,
  },
  {
    title: 'Ratings That Build Your Reputation',
    description:
      'Strong performance leads to more approvals. Organizations review your profile, ratings, and track record before selecting you.',
    icon: StarIcon,
  },
  {
    title: 'One Portal for Everything',
    description:
      'Documents, trip offers, active routes, and payouts — managed in a single Driver Portal with clear status at every step.',
    icon: PortalIcon,
  },
];

const retentionReasons = [
  {
    title: 'Consistent trip demand',
    detail: 'Organizations post recurring and on-demand routes, so eligible drivers always have new opportunities to pursue.',
  },
  {
    title: 'Fair, transparent offer system',
    detail: 'You propose terms on trips you want. No forced assignments — the marketplace respects your independence.',
  },
  {
    title: 'Operational support when you need it',
    detail: 'Platform tools and support help you execute trips professionally, not just find them.',
  },
  {
    title: 'Document clarity & renewal reminders',
    detail: 'Your portal shows exactly what is approved, expiring, or needed — no guessing about eligibility.',
  },
  {
    title: 'Performance visibility',
    detail: 'Ratings and completion history help you build a profile that organizations trust for repeat work.',
  },
  {
    title: '1099 flexibility with structure',
    detail: 'Independent contractor freedom, backed by a professional platform that organizations rely on daily.',
  },
];

const testimonials = [
  {
    quote:
      'I created my account on a Tuesday, uploaded my documents that night, and was submitting offers on real student transport routes by the end of the week. The process was exactly what they said — simple.',
    name: 'Marcus T.',
    role: 'Independent Driver · Kansas City, MO',
    tenure: 'Driving 14 months',
  },
  {
    quote:
      'What sold me was the portal. I can see every document status, every trip detail, and every offer I have out. I have driven for other platforms — this is the most organized by far.',
    name: 'Elena R.',
    role: 'Independent Driver · Phoenix, AZ',
    tenure: 'Driving 9 months',
  },
  {
    quote:
      'I pick trips near my neighborhood, submit my offer, and go. The GPS tools and checklists make me look professional to the schools I work with. That keeps them coming back.',
    name: 'James K.',
    role: 'Independent Driver · Atlanta, GA',
    tenure: 'Driving 18 months',
  },
];

const driverFaqs: FaqItem[] = [
  {
    question: 'How do I start driving with SafeRide Network?',
    answer:
      'Create a Driver account, then upload your required documents in the Driver Portal. Once your documents are reviewed and approved, you can browse posted trips and submit offers. There is no separate application form.',
  },
  {
    question: 'How long does onboarding take?',
    answer:
      'Account creation takes minutes. Document review timing depends on how quickly you submit complete files and finish any required screenings. Many drivers complete initial eligibility within a few business days.',
  },
  {
    question: 'Am I an employee or independent contractor?',
    answer:
      'Drivers are independent contractors (1099). You choose which trips to pursue, set your availability, and operate your own business through the marketplace.',
  },
  {
    question: 'What documents do I need?',
    answer:
      'At minimum: a valid driver\'s license, proof of insurance, vehicle registration, and a certified vehicle inspection. Additional compliance items — background check, drug screening, training records, and more — are tracked in your portal with clear instructions.',
  },
  {
    question: 'What are the vehicle requirements?',
    answer:
      'Your vehicle must be 2012 or newer, properly registered and insured, and in excellent operating condition. Wheelchair-accessible vehicles may qualify for additional specialized trip types.',
  },
  {
    question: 'How do I get paid?',
    answer:
      'Compensation terms are shown on each trip before you submit an offer. After completing approved trips, payouts are processed through the platform. Connect your payout details in the Driver Portal profile.',
  },
  {
    question: 'Can I drive part-time?',
    answer:
      'Yes. Many drivers accept trips around a full-time job, school schedule, or family commitments. You only submit offers on routes that fit your availability.',
  },
  {
    question: 'I already started — where do I continue?',
    answer:
      'Log in to the Driver Portal to upload remaining documents, check approval status, or browse available trips. Your progress is saved to your account.',
  },
];

/* Group onboarding checklist from shared driver document config */
const checklistGroups = [
  {
    phase: 'Start here',
    phaseColor: 'bg-[#1E3A8A] text-white',
    items: defaultDriverDocuments.filter((d) =>
      ['drivers_license', 'proof_of_insurance', 'vehicle_registration', 'vehicle_inspection'].includes(d.type)
    ),
  },
  {
    phase: 'Compliance & screening',
    phaseColor: 'bg-blue-600 text-white',
    items: defaultDriverDocuments.filter((d) =>
      ['english_language_proficiency', 'background_check_fingerprinting', 'drug_test', 'saferide_course'].includes(d.type)
    ),
  },
  {
    phase: 'Safety & training records',
    phaseColor: 'bg-blue-500 text-white',
    items: defaultDriverDocuments.filter((d) =>
      [
        'dot_physical',
        'accident_prevention_course',
        'tb_test',
        'cpr_training',
        'first_aid_training',
        'defensive_driving',
        'safety_meetings',
      ].includes(d.type)
    ),
  },
];

/* ── Icons ── */

function CalendarIcon() {
  return (
    <svg className="h-7 w-7 text-[#1E3A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg className="h-7 w-7 text-[#1E3A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function EarningsIcon() {
  return (
    <svg className="h-7 w-7 text-[#1E3A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg className="h-7 w-7 text-[#1E3A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-7 w-7 text-[#1E3A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function PortalIcon() {
  return (
    <svg className="h-7 w-7 text-[#1E3A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CheckIcon({ className = 'text-[#1E3A8A]' }: { className?: string }) {
  return (
    <svg className={`mt-0.5 h-5 w-5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

/* ── CTA helpers ── */

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] focus-visible:ring-offset-2';

function PrimaryCta({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={SIGN_UP_DRIVER}
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#1E3A8A] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:bg-[#172554] ${focusRing} ${className}`}
    >
      {children}
    </Link>
  );
}

function SecondaryCta({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={DRIVER_PORTAL}
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-[#1E3A8A] bg-white px-8 py-3.5 text-base font-semibold text-[#1E3A8A] transition hover:bg-blue-50 ${focusRing} ${className}`}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">{children}</p>
  );
}

/* ── Page ── */

export default function DriverApplyPage() {
  return (
    <div className="min-h-screen bg-white text-blue-950">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#1E3A8A] to-[#1e40af] text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-blue-300/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 md:pb-28 md:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              Now accepting independent drivers nationwide
            </p>

            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-[3.5rem]">
              Your next income stream is three steps away.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-blue-100 md:text-xl">
              Join the SafeRide Network marketplace. Create your account, upload your documents, and start earning on
              real trips posted by organizations across the country.
            </p>

            {/* Core message pill */}
            <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-6 py-4 backdrop-blur-sm sm:flex-row sm:justify-center sm:gap-0">
              {['Create a Driver Account', 'Upload Documents', 'Start Earning'].map((step, i) => (
                <div key={step} className="flex items-center gap-2 sm:gap-0">
                  <span className="whitespace-nowrap text-sm font-semibold text-white md:text-base">{step}</span>
                  {i < 2 && (
                    <ArrowRightIcon />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCta>
                Get Started — It&apos;s Free
                <ArrowRightIcon />
              </PrimaryCta>
              <SecondaryCta className="border-white/30 bg-white/5 text-white hover:border-white/50 hover:bg-white/10 hover:text-white">
                I Have an Account — Log In
              </SecondaryCta>
            </div>

            <p className="mt-5 text-sm text-blue-200/80">
              No application fees · 1099 independent contractor · Vehicle 2012+
            </p>
          </div>
        </div>
      </section>

      {/* ── 2-Step Process ── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24" aria-labelledby="process-heading">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel>Simple Onboarding</SectionLabel>
          <h2 id="process-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Two steps. Then you&apos;re in the marketplace.
          </h2>
          <p className="mt-4 text-lg text-blue-800">
            We removed the paperwork maze. Everything you need is inside your Driver Portal.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {twoSteps.map((step) => (
            <article
              key={step.number}
              className="group relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-8 shadow-sm transition hover:border-blue-200 hover:shadow-lg md:p-10"
            >
              <div className="absolute -right-4 -top-4 text-[7rem] font-bold leading-none text-blue-50 transition group-hover:text-blue-100/80" aria-hidden="true">
                {step.number}
              </div>
              <div className="relative">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1E3A8A] text-lg font-bold text-white">
                  {step.number}
                </span>
                <h3 className="mt-5 text-2xl font-bold text-blue-950">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-blue-800">{step.description}</p>
                <Link
                  href={step.href}
                  className={`mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A] transition hover:gap-2.5 hover:text-[#172554] ${focusRing} rounded-lg`}
                >
                  {step.cta}
                  <ArrowRightIcon />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* Earning bridge */}
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-center md:px-10">
          <p className="text-lg font-semibold text-emerald-900">
            Once your documents are approved → browse trips → submit offers →{' '}
            <span className="text-[#1E3A8A]">start earning</span>
          </p>
        </div>
      </section>

      {/* ── Onboarding Checklist ── */}
      <section className="border-y border-blue-100 bg-slate-50/80 py-16 md:py-24" aria-labelledby="checklist-heading">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 lg:grid-cols-5 lg:gap-14">
            <div className="lg:col-span-2">
              <SectionLabel>Driver Onboarding Checklist</SectionLabel>
              <h2 id="checklist-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Everything you&apos;ll upload — in one portal
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-blue-800">
                Your Driver Portal shows each requirement with approval status, expiration dates, and upload
                instructions. Start with the essentials, then complete compliance items at your pace.
              </p>
              <ul className="mt-6 space-y-3 text-blue-800">
                <li className="flex items-start gap-3">
                  <CheckIcon />
                  <span>Vehicle must be <strong>2012 or newer</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon />
                  <span>All files uploaded securely in your portal</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon />
                  <span>Real-time status: pending, approved, or needs attention</span>
                </li>
              </ul>
              <div className="mt-8">
                <PrimaryCta>Create Driver Account</PrimaryCta>
              </div>
            </div>

            <div className="space-y-5 lg:col-span-3">
              {checklistGroups.map((group) => (
                <div key={group.phase} className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
                  <div className={`px-5 py-3 text-sm font-bold uppercase tracking-wider ${group.phaseColor}`}>
                    {group.phase}
                  </div>
                  <ul className="divide-y divide-blue-50">
                    {group.items.map((doc) => (
                      <li key={doc.type} className="flex items-start gap-4 px-5 py-4">
                        <CheckIcon className="text-blue-400" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-blue-950">{doc.label}</p>
                          <p className="mt-0.5 text-sm text-blue-600">
                            {doc.cost}
                            {formatDocumentValidity(doc) ? ` · ${formatDocumentValidity(doc)}` : ''}
                            {doc.specialNote ? ` · ${doc.specialNote}` : ''}
                          </p>
                          {doc.description && (
                            <p className="mt-1 text-sm leading-relaxed text-blue-700/90">{doc.description}</p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {doc.uploadable ? 'Upload' : 'Request'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24" aria-labelledby="benefits-heading">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel>Why Drive With SafeRide</SectionLabel>
          <h2 id="benefits-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Built for drivers who take their work seriously
          </h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-blue-100 bg-white p-7 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                <item.icon />
              </div>
              <h3 className="mt-5 text-xl font-bold text-blue-950">{item.title}</h3>
              <p className="mt-3 leading-relaxed text-blue-800">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Why Drivers Stay ── */}
      <section className="border-y border-blue-100 bg-[#0f2347] py-16 text-white md:py-24" aria-labelledby="retention-heading">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionLabel>
                <span className="text-blue-300">Why Drivers Stay</span>
              </SectionLabel>
              <h2 id="retention-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Drivers don&apos;t just sign up — they build a business here
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-blue-200">
                SafeRide Network is designed for long-term driver success, not one-off gigs. Here is what keeps
                independent drivers active on the platform month after month.
              </p>
              <PrimaryCta className="mt-8">Join the Marketplace</PrimaryCta>
            </div>
            <ul className="space-y-4">
              {retentionReasons.map((item) => (
                <li
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:bg-white/10"
                >
                  <div className="flex items-start gap-3">
                    <CheckIcon className="text-emerald-400" />
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-blue-200">{item.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24" aria-labelledby="testimonials-heading">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel>Driver Stories</SectionLabel>
          <h2 id="testimonials-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Real drivers. Real results.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((item) => (
            <figure
              key={item.name}
              className="flex flex-col rounded-3xl border border-blue-100 bg-white p-7 shadow-sm"
            >
              <div className="flex gap-0.5 text-amber-400" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-4 w-4 fill-current" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-4 flex-1 leading-relaxed text-blue-800">
                &ldquo;{item.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 border-t border-blue-50 pt-5">
                <p className="font-bold text-blue-950">{item.name}</p>
                <p className="text-sm text-blue-600">{item.role}</p>
                <p className="mt-1 text-xs font-medium text-emerald-700">{item.tenure}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-blue-100 bg-blue-50/40 py-16 md:py-24" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <SectionLabel>FAQ</SectionLabel>
            <h2 id="faq-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Questions before you sign up?
            </h2>
            <p className="mt-3 text-blue-800">Everything you need to know about getting started as a driver.</p>
          </div>
          <FaqAccordion items={driverFaqs} className="mt-10" />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-4" aria-labelledby="final-cta-heading">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#1e40af] px-8 py-14 text-center text-white shadow-2xl shadow-blue-900/30 md:px-16 md:py-20">
          <div className="pointer-events-none absolute inset-0 opacity-20" aria-hidden="true">
            <div className="absolute -left-10 top-0 h-64 w-64 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl" />
          </div>
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Ready to earn?</p>
            <h2 id="final-cta-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
              Create your account. Upload your docs. Start earning.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
              Join thousands of organizations and independent drivers on the nation&apos;s professional transportation
              marketplace. Your Driver Portal is waiting.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={SIGN_UP_DRIVER}
                className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-white px-10 py-4 text-lg font-bold text-[#1E3A8A] shadow-lg transition hover:bg-blue-50 ${focusRing}`}
              >
                Get Started — Create Driver Account
                <ArrowRightIcon />
              </Link>
              <Link
                href={DRIVER_PORTAL}
                className={`inline-flex min-h-[56px] items-center justify-center rounded-2xl border-2 border-white/40 px-10 py-4 text-lg font-semibold text-white transition hover:bg-white/10 ${focusRing}`}
              >
                Log In to Driver Portal
              </Link>
            </div>
            <p className="mt-6 text-sm text-blue-200/80">
              Free to join · No commitment until you submit an offer · 1099 independent contractor
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}