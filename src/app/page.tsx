import ApplicationForm from "@/components/ApplicationForm";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <a href="/" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="LivePlay Hosts"
                className="h-8 md:h-10 w-auto"
              />
            </a>
            <div className="flex gap-2 sm:gap-3 items-center">
              <a
                href="/sign-in"
                className="bg-primary text-white font-semibold py-2 px-4 sm:py-3 sm:px-6 text-sm sm:text-base rounded-lg hover:bg-primary/90 transition-colors duration-200 inline-flex items-center justify-center"
              >
                Host Login
              </a>
              <a
                href="#apply"
                className="btn-cta py-2 px-4 sm:py-3 sm:px-6 text-sm sm:text-base inline-flex items-center justify-center"
              >
                Apply Now
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Video Background */}
      <section className="relative min-h-[600px] lg:min-h-[700px] flex items-center overflow-hidden">
        {/* Video Background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/hero-video.mp4" type="video/mp4" />
          <source src="/hero-video.mov" type="video/quicktime" />
        </video>

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight drop-shadow-lg">
              Become a{" "}
              <span style={{ color: '#52b3d3' }}>LivePlay</span>{" "}
              <span style={{ color: '#52b3d3' }}>Host</span>
            </h1>
            <p className="mt-6 text-xl md:text-2xl text-gray-100 leading-relaxed drop-shadow">
              Turn your passion into a career. Engage live audiences, build your
              brand, and earn money doing what you love.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#apply" className="btn-cta text-lg">
                Start Your Application
              </a>
              <a
                href="#benefits"
                className="bg-white/90 text-primary font-semibold py-3 px-8 rounded-lg border-2 border-white hover:bg-white transition-colors duration-200 text-lg"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="section-heading">Why Become a Host?</h2>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              Join a growing community of professional hosts and unlock new opportunities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Benefit 1 - Competitive Pay */}
            <div className="bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div className="h-48">
                <img
                  src="/benefit-1.jpg"
                  alt="Competitive Pay"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-dark mb-3 text-center">Competitive Pay</h3>
                <p className="text-gray-600 text-center">
                  <span className="text-dark">Get Paid to Be You:</span> LivePlay hosts earn real money doing what they love. Your energy, personality, and consistency directly drive your income. The better you connect, the more you earn.
                </p>
              </div>
            </div>

            {/* Benefit 2 - Flexible Schedule */}
            <div className="bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div className="h-48">
                <img
                  src="/benefit-2.jpg"
                  alt="Flexible Schedule"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-dark mb-3 text-center">Flexible Schedule</h3>
                <p className="text-gray-600 text-center">
                  <span className="text-dark">Your Schedule. Your Passion:</span> Craft a schedule that fits your life and all of your passions. Whether you thrive late nights or in daytime energy, we host shows 24/7/365 - so we can negotiate a schedule that works for you.
                </p>
              </div>
            </div>

            {/* Benefit 3 - Professional Training */}
            <div className="bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div className="h-48">
                <img
                  src="/benefit-training.jpg"
                  alt="Professional Training"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-dark mb-3 text-center">Professional Training</h3>
                <p className="text-gray-600 text-center">
                  <span className="text-dark">Train Like a Pro:</span> We&apos;ve produced over 90,000 hours of live content, so we know what great is. We don&apos;t throw you on camera and hope for the best. You&apos;ll get cutting-edge frameworks, live feedback, and performance coaching to help you grow faster and stand out on screen.
                </p>
              </div>
            </div>

            {/* Benefit 4 - Community Support */}
            <div className="bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div className="h-48">
                <img
                  src="/benefit-community.jpg"
                  alt="Community Support"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-dark mb-3 text-center">Community Support</h3>
                <p className="text-gray-600 text-center">
                  <span className="text-dark">You&apos;re Not Doing This Alone:</span> Join a tight-knit A-team of hosts who share insights, support each other, and celebrate wins together. Collaboration beats competition here.
                </p>
              </div>
            </div>

            {/* Benefit 5 - Growth Opportunities */}
            <div className="bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div className="h-48">
                <img
                  src="/benefit-growth.jpg"
                  alt="Growth Opportunities"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-dark mb-3 text-center">Growth Opportunities</h3>
                <p className="text-gray-600 text-center">
                  <span className="text-dark">Build a Real Platform:</span> Your show is more than a shift. It&apos;s a brand. Top hosts unlock higher visibility, premium shows, special events &amp; training, and long-term growth opportunities.
                </p>
              </div>
            </div>

            {/* Benefit 6 - Creative Freedom */}
            <div className="bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div className="h-48">
                <img
                  src="/benefit-creative.jpg"
                  alt="Creative Freedom"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-dark mb-3 text-center">Creative Freedom</h3>
                <p className="text-gray-600 text-center">
                  <span className="text-dark">Bring Your Personality On-Air:</span> We&apos;re not looking for scripted robots. It&apos;s your voice, your style, your energy. Authenticity wins here, and audiences feel the difference.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="pt-0 pb-32 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Divider line */}
          <div className="border-t border-gray-300 mb-24"></div>

          <div className="text-center mb-16">
            <h2 className="section-heading">How It Works</h2>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              Getting started is easy. Follow these simple steps to begin your journey.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-cta text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">Apply</h3>
              <p className="text-gray-600">
                Fill out our simple application form and upload your video reel
                showcasing your hosting skills.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">Train</h3>
              <p className="text-gray-600">
                Complete our professional training program to learn the skills
                and techniques of successful hosts.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6" style={{ backgroundColor: '#52b3d3' }}>
                3
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">Host</h3>
              <p className="text-gray-600">
                Start hosting live sessions, engage with audiences, and earn
                money doing what you love.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Application Form Section */}
      <section id="apply" className="py-20 bg-dark">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Apply to Become a Host</h2>
            <p className="mt-4 text-xl text-white/80">
              Ready to start your journey? Fill out the form below and we&apos;ll be
              in touch.
            </p>
          </div>

          <ApplicationForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <img
                src="/logo-white.png"
                alt="LivePlay Hosts"
                className="h-6 w-auto"
              />
            </div>
            <div className="text-gray-400 text-sm">
              © 2026 LivePlay Services. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
