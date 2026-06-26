'use client';

import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/app/components/Navbar';
import FaqAccordion, { type FaqItem } from '@/components/public/FaqAccordion';

const SIGN_UP_DRIVER = '/sign-up?type=driver';
const DRIVER_PORTAL = '/driver-portal';

const HERO_IMAGE = '/driver-hero-rear-seat-final.jpg';
const HERO_IMAGE_ALT = 'Independent Contractor Driver - SafeRide Network';

const onboardingChecklist = [
  "Valid U.S. Driver's License",
  'Clean driving record',
  'Proof of commercial auto insurance',
  'Vehicle registration & inspection',
  'Background check authorization',
  'Smartphone with reliable data & GPS',
];

const twoSteps = [
  {
    step: '1',
    title: 'Create Your Driver Account',
    body: 'Sign up in minutes. Select Driver at registration — no lengthy application, no waiting on callbacks.',
  },
  {
    step: '2',
    title: 'Upload Documents & Go Live',
    body: 'Use the Driver Portal to upload required documents, track approval status, and start browsing trips nationwide.',
  },
];

const benefits = [
  {
    title: 'Nationwide Trip Demand',
    description:
      'Browse real trips posted by organizations across the United States — schools, medical, senior services, and more.',
    icon: GlobeIcon,
    imageSrc: '/nationwide-trip-demand.jpg',
    imageAlt: 'Nationwide Trip Demand across the United States',
    imageOverlay: 'from-black/20',
  },
  {
    title: 'You Control Your Schedule',
    description:
      'Submit offers only on routes that fit your availability. Full-time, part-time, or weekends — your call.',
    icon: ClockIcon,
    imageSrc: '/you-control-schedule.jpg',
    imageAlt: 'You control your schedule - Flexible driving with SafeRide Network',
    imageOverlay: 'from-black/10',
  },
  {
    title: 'Transparent Earnings',
    description:
      'See trip details and compensation before you commit. No surprises — know what you are agreeing to upfront.',
    icon: DollarIcon,
    imageSrc: '/transparent-earnings.jpg',
    imageAlt: 'Transparent Earnings - See trip details and compensation upfront',
    imageOverlay: 'from-black/10',
  },
  {
    title: 'Professional Driver Tools',
    description:
      'Live GPS, pre-trip checklists, geofence alerts, and trip history — operational tools built for reliability.',
    icon: ToolsIcon,
    imageSrc: '/professional-driver-tools.jpg',
    imageAlt: 'Professional Driver Tools - Live GPS, checklists, and geofencing',
    imageOverlay: 'from-black/10',
  },
  {
    title: 'Build Your Reputation',
    description:
      'Ratings and completion history help you win repeat work from organizations that value reliability.',
    icon: StarIcon,
    imageSrc: '/build-your-reputation.jpg',
    imageAlt: 'Build Your Reputation - High ratings and reliable completion history',
    imageOverlay: 'from-black/10',
  },
  {
    title: 'One Portal for Everything',
    description:
      'Documents, offers, active trips, and profile — managed in a single Driver Portal with clear status updates.',
    icon: PortalIcon,
    imageSrc: '/one-portal-everything.jpg',
    imageAlt: 'One Portal for Everything - Documents, trips, offers, and profile in one place',
    imageOverlay: 'from-black/10',
  },
];

const retentionStrategies = [
  {
    title: 'Steady marketplace demand',
    detail: 'Organizations across the country post recurring and on-demand routes — eligible drivers always have new trips to pursue.',
  },
  {
    title: 'Fair, transparent offers',
    detail: 'You propose terms on trips you want. No forced assignments — the marketplace respects your independence as a 1099 contractor.',
  },
  {
    title: 'Operational support',
    detail: 'Platform tools and support help you execute professionally, building trust with every completed trip.',
  },
  {
    title: 'Document clarity',
    detail: 'Your portal shows what is approved, expiring, or needed — no guessing about eligibility status.',
  },
  {
    title: 'Performance visibility',
    detail: 'Strong ratings and completion history help you stand out when organizations review driver profiles.',
  },
  {
    title: 'Long-term driver success',
    detail: 'Built for drivers who want to grow a sustainable independent business, not just pick up a single gig.',
  },
];

const testimonials = [
  {
    quote:
      'I finished all the requirements in just a few days. Once approved, I was home free — picking my own routes and making a great living on my own schedule.',
    name: 'Raj Patel',
    tenure: '8 months',
  },
  {
    quote:
      'The portal keeps everything organized — document status, trip details, every offer I have out. I have driven for other platforms and this is the most professional by far.',
    name: 'Elena R.',
    tenure: '9 months',
  },
  {
    quote:
      'I pick trips that match my schedule, submit my offer, and go. The GPS tools and checklists make me look professional to every organization I work with.',
    name: 'James K.',
    tenure: '18 months',
  },
];

const faqItems: FaqItem[] = [
  {
    question: 'How do I apply to drive with SafeRide Network?',
    answer:
      'Create a Driver account at sign-up, then upload your required documents in the Driver Portal. Once reviewed and approved, you can browse posted trips nationwide and submit offers. There is no separate paper application.',
  },
  {
    question: 'How long does onboarding take?',
    answer:
      'Account creation takes minutes. Document review depends on how quickly you submit complete files and finish required screenings. Many drivers complete initial eligibility within a few business days.',
  },
  {
    question: 'Am I an employee or independent contractor?',
    answer:
      'Drivers are independent contractors (1099) operating nationwide. You choose which trips to pursue and set your own availability.',
  },
  {
    question: 'What vehicle do I need?',
    answer:
      'A reliable vehicle that is 2012 or newer, properly registered and insured, and in excellent operating condition. Wheelchair-accessible vehicles may qualify for additional specialized trip types.',
  },
  {
    question: 'Where do I upload documents?',
    answer:
      'All documents are uploaded in the Driver Portal under Documents after you sign up. Track approval status in real time from any device.',
  },
  {
    question: 'How do I get paid?',
    answer:
      'Compensation terms are shown on each trip before you submit an offer. After completing approved trips, payouts are processed through the platform. Connect payout details in your Driver Portal profile.',
  },
  {
    question: 'Can I drive part-time?',
    answer:
      'Yes. Many drivers accept trips around a full-time job or family schedule. You only submit offers on routes that fit your life.',
  },
  {
    question: 'I already started — where do I continue?',
    answer:
      'Log in to the Driver Portal to upload remaining documents, check approval status, or browse available trips nationwide.',
  },
];

/* ── Icons ── */

function GlobeIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function PortalIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CheckIcon({ className = 'text-[#1E3A8A]' }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] focus-visible:ring-offset-2';

function PrimaryButton({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={SIGN_UP_DRIVER}
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#1E3A8A] px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-900/25 transition hover:-translate-y-0.5 hover:bg-[#172554] hover:shadow-xl ${focusRing} ${className}`}
    >
      {children}
    </Link>
  );
}

function SecondaryButton({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={DRIVER_PORTAL}
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-[#1E3A8A] bg-white px-8 py-3.5 text-base font-semibold text-[#1E3A8A] transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md ${focusRing} ${className}`}
    >
      {children}
    </Link>
  );
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">{children}</p>
  );
}

function BenefitPhotoHeader({
  src,
  alt,
  overlay = 'from-black/20',
}: {
  src: string;
  alt: string;
  overlay?: string;
}) {
  return (
    <div className="relative">
      <Image src={src} alt={alt} width={800} height={224} className="h-56 w-full object-cover" sizes="(max-width: 768px) 100vw, 400px" />
      <div className={`absolute inset-0 bg-gradient-to-b ${overlay} to-transparent`} aria-hidden="true" />
    </div>
  );
}

/** Decorative gradient header for benefit cards without a photo yet */
function BenefitCardHeader({
  alt,
  icon: Icon,
  className = '',
}: {
  alt: string;
  icon: () => React.ReactElement;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#3b82f6] ${className}`}
      role="img"
      aria-label={alt}
    >
      <div className="absolute inset-0 opacity-20" aria-hidden="true">
        <div className="absolute -left-8 top-4 h-32 w-32 rounded-full bg-white/30 blur-2xl" />
        <div className="absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-sky-200/40 blur-xl" />
      </div>
      <div className="relative flex h-full items-center justify-center p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-sm">
          <Icon />
        </div>
      </div>
    </div>
  );
}

export default function ApplyToDrivePage() {
  return (
    <div className="min-h-screen bg-white text-blue-950">
      <Navbar />

      {/* ── 1. Hero — Strong Earnings Focus (aligned with header logo) ── */}
      <section className="relative flex min-h-[620px] items-start overflow-hidden pb-10 pt-14 md:min-h-[720px] md:pb-14 md:pt-20">
        <Image
          src={HERO_IMAGE}
          alt={HERO_IMAGE_ALT}
          fill
          priority
          className="object-cover"
          style={{ filter: 'brightness(0.75) contrast(1.08)' }}
          sizes="100vw"
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-3 text-left text-white sm:px-4 xl:px-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-5 py-2 text-sm font-medium backdrop-blur-md">
            Independent Contractor Drivers • Nationwide
          </div>

          <h1 className="mb-4 max-w-[620px] text-3xl font-bold leading-[1.1] tracking-[-1px] sm:text-4xl md:mb-5 md:text-[2.75rem] lg:text-5xl">
            Take control of your income.
            <br />
            Drive when you want.
            <br />
            Get paid what you&apos;re worth.
          </h1>

          <p className="mb-6 max-w-2xl text-lg font-light text-white/90 md:mb-8 md:text-xl">
            Join SafeRide Network — the nationwide platform where qualified independent drivers connect
            directly with schools, medical providers, and organizations that need reliable transportation.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href={SIGN_UP_DRIVER}
              className={`rounded-2xl bg-white px-8 py-3.5 text-base font-semibold text-[#1e3a8a] shadow-xl transition-all hover:scale-[1.02] hover:bg-blue-50 md:px-10 md:py-4 md:text-lg ${focusRing}`}
            >
              Create Driver Account — Start Free
            </Link>
            <Link
              href={DRIVER_PORTAL}
              className={`rounded-2xl border-2 border-white/90 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 md:px-8 md:py-4 ${focusRing}`}
            >
              Log in to Driver Portal
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-base text-white/90 md:mt-8 md:text-lg">
            <span className="flex items-center gap-2">
              <span className="text-green-400">↑</span>
              One-way trips paying <strong>$28+</strong>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-400" aria-hidden="true" />
              Drivers earning <strong>$1,200+</strong> weekly
            </span>
          </div>
        </div>
      </section>

      {/* ── 2. How It Works ── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24" aria-labelledby="how-heading">
        <div className="mx-auto max-w-2xl text-center">
          <SectionTag>How It Works</SectionTag>
          <h2 id="how-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Two steps. Then you&apos;re in the marketplace.
          </h2>
          <p className="mt-4 text-lg text-blue-800">
            Simple onboarding designed for busy professionals — no paperwork mazes, no phone tag.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {twoSteps.map((item) => (
            <article
              key={item.step}
              className="group relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-8 shadow-md transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl md:p-10"
            >
              <div
                className="absolute -right-6 -top-6 text-[8rem] font-black leading-none text-blue-50 transition group-hover:text-blue-100"
                aria-hidden="true"
              >
                {item.step}
              </div>
              <div className="relative">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E3A8A] text-xl font-bold text-white shadow-lg">
                  {item.step}
                </span>
                <h3 className="mt-6 text-2xl font-bold">{item.title}</h3>
                <p className="mt-3 leading-relaxed text-blue-800">{item.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-6 py-5 text-center shadow-sm">
          <p className="text-lg font-semibold text-emerald-900">
            Documents approved → browse trips nationwide → submit offers →{' '}
            <span className="text-[#1E3A8A]">start earning</span>
          </p>
        </div>
      </section>

      {/* ── 3. Driver Onboarding Checklist ── */}
      <section className="mx-auto max-w-7xl px-6 py-20" aria-labelledby="checklist-heading">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <Image
              src="/driver-portal-dashboard.jpg"
              alt="SafeRide Driver Portal Dashboard - Track documents and requirements"
              width={1400}
              height={900}
              className="w-full rounded-3xl border border-blue-100 shadow-2xl"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
              Driver Onboarding Checklist
            </p>

            <h2 id="checklist-heading" className="mb-4 text-4xl font-bold leading-tight text-blue-950">
              Everything you need — tracked in one portal
            </h2>

            <p className="mb-8 text-lg text-blue-700">
              Upload documents securely after sign-up. Your Driver Portal shows real-time approval status for every
              requirement — built for drivers operating across the United States.
            </p>

            <div className="space-y-3 text-lg text-blue-950">
              {onboardingChecklist.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="text-xl text-green-600" aria-hidden="true">
                    ✓
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <Link
                href={SIGN_UP_DRIVER}
                className={`inline-block rounded-2xl bg-[#1e3a8a] px-10 py-4 font-semibold text-white transition hover:bg-blue-950 ${focusRing}`}
              >
                Create Driver Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Benefits ── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24" aria-labelledby="benefits-heading">
        <div className="mx-auto max-w-2xl text-center">
          <SectionTag>Why Drive With SafeRide</SectionTag>
          <h2 id="benefits-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Six reasons drivers choose SafeRide Network
          </h2>
          <p className="mt-4 text-lg text-blue-800">
            Professional tools, nationwide demand, and a platform built for independent contractors who take pride in their work.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item) => {
            const hasPhoto = 'imageSrc' in item && item.imageSrc;

            return (
              <article
                key={item.title}
                className="group overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
              >
                {hasPhoto ? (
                  <BenefitPhotoHeader
                    src={item.imageSrc!}
                    alt={item.imageAlt}
                    overlay={'imageOverlay' in item ? item.imageOverlay : undefined}
                  />
                ) : (
                  <BenefitCardHeader alt={item.imageAlt} icon={item.icon} className="aspect-[16/10]" />
                )}
                <div className={hasPhoto ? 'p-8' : 'p-7'}>
                  <h3 className={`font-semibold text-blue-950 ${hasPhoto ? 'mb-3 text-2xl' : 'mt-5 text-xl font-bold'}`}>
                    {item.title}
                  </h3>
                  <p className={`leading-relaxed ${hasPhoto ? 'text-lg text-blue-700' : 'mt-3 text-blue-800'}`}>
                    {item.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── 5. Why Drivers Stay ── */}
      <section className="bg-[#0f172a] py-20 text-white" aria-labelledby="retention-heading">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <Image
                src="/why-drivers-stay-hero.jpg"
                alt="Built for long-term success as an independent driver"
                width={1200}
                height={800}
                className="w-full rounded-3xl shadow-2xl"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>

            <div>
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
                Why Drivers Stay
              </p>

              <h2 id="retention-heading" className="mb-6 text-4xl font-bold leading-tight md:text-5xl">
                Built for long-term success —
                <br />
                not one-off gigs
              </h2>

              <p className="mb-8 text-xl text-blue-200">
                SafeRide Network is designed to help independent drivers build a sustainable business serving
                organizations across the United States month after month.
              </p>

              <Link
                href={SIGN_UP_DRIVER}
                className={`inline-block rounded-2xl bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-700 ${focusRing}`}
              >
                Join the Marketplace
              </Link>
            </div>
          </div>

          <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {retentionStrategies.map((item) => (
              <li
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:bg-white/10"
              >
                <div className="flex items-start gap-3">
                  <CheckIcon className="text-emerald-400" />
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-blue-200">{item.detail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 6. Testimonials ── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24" aria-labelledby="testimonials-heading">
        <div className="mx-auto max-w-2xl text-center">
          <SectionTag>Driver Stories</SectionTag>
          <h2 id="testimonials-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Trusted by drivers nationwide
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="mx-auto w-full max-w-lg rounded-3xl border border-blue-100 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-6 flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-3xl"
                  aria-hidden="true"
                >
                  ⭐
                </div>
                <figcaption>
                  <p className="font-semibold text-blue-950">{t.name}</p>
                  <p className="text-sm text-blue-600">Independent Driver • {t.tenure}</p>
                </figcaption>
              </div>
              <blockquote className="text-xl italic leading-relaxed text-blue-950">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
            </figure>
          ))}
        </div>
      </section>

      {/* ── 7. FAQ ── */}
      <section className="border-t border-blue-100 bg-blue-50/50 py-16 md:py-24" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <SectionTag>FAQ</SectionTag>
            <h2 id="faq-heading" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Questions before you sign up?
            </h2>
          </div>
          <FaqAccordion items={faqItems} className="mt-10" />
        </div>
      </section>

      {/* ── 8. Final CTA ── */}
      <section className="mx-auto max-w-6xl px-6 pb-20" aria-labelledby="final-cta">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#1e40af] px-8 py-14 text-center text-white shadow-2xl md:px-16 md:py-20">
          <div className="pointer-events-none absolute inset-0 opacity-25" aria-hidden="true">
            <div className="absolute -left-16 top-0 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
            <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-sky-300/40 blur-3xl" />
          </div>
          <div className="relative">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-200">Start today</p>
            <h2 id="final-cta" className="mt-3 text-3xl font-bold md:text-5xl">
              Your next chapter starts with one click.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
              Create your Driver account, upload your documents, and join the nationwide marketplace serving
              organizations across the United States.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={SIGN_UP_DRIVER}
                className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-white px-10 py-4 text-lg font-bold text-[#1E3A8A] shadow-xl transition hover:-translate-y-0.5 hover:bg-blue-50 ${focusRing}`}
              >
                Get Started — Create Driver Account
                <ArrowIcon />
              </Link>
              <Link
                href={DRIVER_PORTAL}
                className={`inline-flex min-h-[56px] items-center justify-center rounded-2xl border-2 border-white/40 px-10 py-4 text-lg font-semibold transition hover:bg-white/10 ${focusRing}`}
              >
                Log In to Driver Portal
              </Link>
            </div>
            <p className="mt-6 text-sm text-blue-200/80">
              Free to join · No commitment until you submit an offer · Nationwide coverage
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}