export default function Welcome() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-700">Safe Ride Network</div>
          <div className="flex gap-8 text-sm font-medium">
            <a href="/" className="hover:text-blue-600">Home</a>
            <a href="/#services" className="hover:text-blue-600">Services</a>
            <a href="/#apply" className="hover:text-blue-600">Apply to Drive</a>
            <a href="/#contact" className="hover:text-blue-600">Contact</a>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50">
              Get a Ride
            </button>
            <button className="px-5 py-2 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
              Apply to Drive
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-8">
          Welcome to Safe Ride Network
        </h1>

        <div className="max-w-3xl text-lg text-gray-700 space-y-6 mb-12">
          <p>
            Safe Ride Network is your single source for safe, reliable transportation for all of life’s needs. We are committed to providing exceptional, on-time service with professional drivers and a modern fleet.
          </p>

          <p>
            Our professional drivers have fulfilled extensive requirements, including DOT physicals, drug testing, First Aid and CPR certification, and defensive driving courses. All vehicles must pass a comprehensive inspection by a certified mechanic to ensure your safety.
          </p>
        </div>

        <h2 className="text-4xl font-bold mb-6">Our Transportation Services</h2>

        <p className="text-lg text-gray-600 mb-8">
          We offer a complete range of services tailored to your specific needs:
        </p>

        <p className="text-lg text-gray-600 mb-4">We offer a complete range of services tailored to your specific needs:</p>

        <ul className="list-disc pl-6 space-y-4 text-gray-700 text-lg mb-8">
          <li><strong>Everyday Rides:</strong> Get to work, the store, or run errands. We provide safe, punctual, and professional rides for all your daily transportation.</li>
          <li><strong>Student Transportation:</strong> We offer dependable rides to and from school. Our service features rigorously trained, background-checked drivers and real-time GPS tracking for parent and school peace of mind.</li>
          <li><strong>Non-Emergency Medical Transport (NEMT):</strong> We provide reliable transport to medical appointments. Our fleet is equipped with wheelchair-accessible vehicles, and our drivers are trained in patient care and door-to-door assistance.</li>
          <li><strong>Elderly Transportation:</strong> We deliver compassionate, door-to-door service to help seniors travel safely to appointments, social events, and daily activities, supporting their independence.</li>
          <li><strong>Medical Courier &amp; Last-Mile Delivery:</strong> We ensure the secure and timely delivery of critical medical supplies, specimens, and records. Our service includes strict handling protocols and real-time tracking.</li>
        </ul>

        <p className="text-xl text-gray-700 max-w-3xl">
          For every ride, Safe Ride Network is your trusted partner for safe, reliable, and hassle-free transportation.
        </p>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Safe Ride Network. Wichita, Kansas.
        </div>
      </footer>
    </div>
  );
}
