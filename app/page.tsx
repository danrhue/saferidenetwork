export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-700">Safe Ride Network</div>
          <div className="flex gap-8 text-sm font-medium">
            <a href="#services" className="hover:text-blue-600">Services</a>
            <a href="#why-us" className="hover:text-blue-600">Why Us</a>
            <a href="#apply" className="hover:text-blue-600">Apply to Drive</a>
            <a href="#contact" className="hover:text-blue-600">Contact</a>
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

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6">
          Support Local Drivers.<br />Get a Ride in Wichita, Kansas.
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
          Safe Ride Network is your trusted source for safe, reliable transportation. 
          We provide professional drivers and a modern fleet for all of life’s transportation needs.
        </p>

        <div className="flex justify-center gap-4">
          <button className="px-8 py-3.5 text-lg font-semibold bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition">
            Get a Ride
          </button>
          <button className="px-8 py-3.5 text-lg font-semibold border border-gray-300 rounded-xl hover:bg-gray-50 transition">
            Apply to Drive
          </button>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-12">Our Transportation Services</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Everyday Rides",
                desc: "Safe, punctual rides for work, errands, appointments, and daily needs."
              },
              {
                title: "Student Transportation",
                desc: "Reliable school transportation with background-checked drivers and real-time GPS tracking for parent peace of mind."
              },
              {
                title: "Non-Emergency Medical Transport (NEMT)",
                desc: "Wheelchair-accessible vehicles and trained drivers for medical appointments with door-to-door assistance."
              },
              {
                title: "Elderly Transportation",
                desc: "Compassionate, door-to-door service helping seniors maintain independence."
              },
              {
                title: "Medical Courier & Last-Mile Delivery",
                desc: "Secure delivery of medical supplies, specimens, and records with strict protocols and tracking."
              }
            ].map((service, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-sm border">
                <h3 className="text-2xl font-semibold mb-4">{service.title}</h3>
                <p className="text-gray-600 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section id="why-us" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Why Choose Safe Ride Network?</h2>
          <p className="text-xl text-gray-600">Safety and reliability are at the core of everything we do.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            "Professionally trained and background-checked drivers",
            "Modern, well-maintained fleet with regular inspections",
            "Real-time GPS tracking on student and medical transports"
          ].map((point, i) => (
            <div key={i} className="text-center p-6">
              <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-2xl">✓</div>
              <p className="font-medium text-lg">{point}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section id="apply" className="bg-blue-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Drive With Us?</h2>
          <p className="text-xl mb-8 text-blue-100">Join our team of professional drivers and set your own schedule.</p>
          <button className="px-10 py-4 text-lg font-semibold bg-white text-blue-700 rounded-xl hover:bg-gray-100 transition">
            Apply to Drive
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Safe Ride Network. Wichita, Kansas.
        </div>
      </footer>
    </div>
  );
}
