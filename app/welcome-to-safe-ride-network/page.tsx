import Navbar from '../components/Navbar';

export default function Welcome() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold tracking-tight text-blue-950 mb-8">
          Welcome to Safe Ride Network
        </h1>

        <div className="max-w-3xl text-lg text-blue-950 space-y-6 mb-12">
          <p>
            Safe Ride Network is a professional transportation marketplace that connects organizations needing reliable transportation with qualified independent drivers. Post trips, browse opportunities, submit offers, and monitor execution with real-time GPS, geofencing, and complete historical trails.
          </p>

          <p>
            All drivers complete rigorous screening. Organizations gain live operational visibility and post-trip accountability. Drivers gain access to real trips and professional execution tools.
          </p>
        </div>

        <h2 className="text-4xl font-bold mb-6 text-gray-900">Transportation Categories</h2>

        <p className="text-lg text-gray-900 mb-8">
          Organizations post trips across these common needs. Drivers offer on the trips that fit their schedule and capabilities:
        </p>

        <ul className="list-disc pl-6 space-y-4 text-gray-900 text-lg mb-8">
          <li><strong>Student Transportation:</strong> School routes with qualified drivers and live tracking for families and administrators.</li>
          <li><strong>Non-Emergency Medical (NEMT):</strong> Reliable medical appointment transport, including accessible vehicles.</li>
          <li><strong>Elderly &amp; Accessible Services:</strong> Door-to-door support for seniors and those with mobility needs.</li>
          <li><strong>Medical Courier &amp; Logistics:</strong> Secure, tracked delivery of supplies and specimens with full audit trails.</li>
          <li><strong>General &amp; Group Transport:</strong> Work commutes, events, and other organized transportation needs.</li>
        </ul>

        <p className="text-xl text-gray-900 max-w-3xl">
          Visit <a href="/how-it-works" className="text-[#1E3A8A] hover:underline">How It Works</a> to see the full two-sided marketplace flow, or <a href="/sign-up" className="text-[#1E3A8A] hover:underline">create an account</a> (select Organization or Driver).
        </p>
      </div>

    </div>
  );
}
