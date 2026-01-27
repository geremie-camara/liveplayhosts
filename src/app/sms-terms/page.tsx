import Link from "next/link";

export const metadata = {
  title: "SMS Terms & Opt-In | LivePlay Hosts",
  description: "SMS messaging terms and opt-in information for LivePlay shift notifications",
};

export default function SmsTermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo-wide.svg"
              alt="LivePlay"
              className="h-8 sm:h-10"
            />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
            SMS Messaging Terms & Opt-In
          </h1>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Program Description
              </h2>
              <p className="text-gray-700 mb-4">
                LivePlay Hosts uses SMS messaging to send important shift notifications,
                schedule updates, and broadcast messages to our hosts and team members.
                By providing your mobile phone number and opting in to receive SMS messages,
                you agree to receive text messages from LivePlay related to your hosting schedule
                and work-related communications.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                What Messages You Will Receive
              </h2>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Shift reminders and schedule notifications</li>
                <li>Important broadcast messages from LivePlay management</li>
                <li>Schedule changes and updates</li>
                <li>Time-sensitive work-related alerts</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Message Frequency
              </h2>
              <p className="text-gray-700 mb-4">
                Message frequency varies based on your schedule and company announcements.
                You may receive multiple messages per week during active scheduling periods.
                We limit non-urgent messages and respect your time.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                How to Opt-In
              </h2>
              <p className="text-gray-700 mb-4">
                To opt-in to receive SMS notifications from LivePlay:
              </p>
              <ol className="list-decimal list-inside text-gray-700 space-y-2 mb-4">
                <li>Log in to your LivePlay Hosts account</li>
                <li>Navigate to your Profile settings</li>
                <li>Enter your mobile phone number in the Phone field</li>
                <li>Save your profile to confirm your opt-in</li>
              </ol>
              <p className="text-gray-700">
                By providing your phone number, you expressly consent to receive SMS messages
                from LivePlay for work-related communications.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                How to Opt-Out
              </h2>
              <p className="text-gray-700 mb-4">
                You can opt-out of SMS messages at any time by:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>Replying <strong>STOP</strong> to any SMS message you receive from us</li>
                <li>Removing your phone number from your profile settings</li>
                <li>Contacting us at the email address below</li>
              </ul>
              <p className="text-gray-700">
                After opting out, you will receive one final confirmation message.
                You will no longer receive SMS notifications, but you may still receive
                messages through other channels (email, Slack) if those are enabled.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Help
              </h2>
              <p className="text-gray-700 mb-4">
                For help with SMS messaging, reply <strong>HELP</strong> to any message
                or contact us at:
              </p>
              <p className="text-gray-700">
                Email: <a href="mailto:support@liveplayhosts.com" className="text-accent hover:underline">support@liveplayhosts.com</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Costs
              </h2>
              <p className="text-gray-700">
                Message and data rates may apply. LivePlay does not charge for SMS messages,
                but your mobile carrier may charge standard messaging fees.
                Please contact your carrier for details about your text messaging plan.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Privacy
              </h2>
              <p className="text-gray-700 mb-4">
                Your phone number and messaging data are kept confidential. We do not sell,
                rent, or share your phone number with third parties for marketing purposes.
                Your information is used solely for LivePlay work-related communications.
              </p>
              <p className="text-gray-700">
                For more information, please review our{" "}
                <Link href="/privacy" className="text-accent hover:underline">
                  Privacy Policy
                </Link>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Supported Carriers
              </h2>
              <p className="text-gray-700 mb-4">
                SMS messaging is supported on all major US carriers including AT&T, Verizon,
                T-Mobile, Sprint, and most regional carriers. International messaging may
                have limited support.
              </p>
            </section>

            <section className="border-t pt-8 mt-8">
              <p className="text-sm text-gray-500">
                Last updated: January 2026
              </p>
              <p className="text-sm text-gray-500 mt-2">
                LivePlay Mobile, Inc.<br />
                For questions, contact: <a href="mailto:support@liveplayhosts.com" className="text-accent hover:underline">support@liveplayhosts.com</a>
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} LivePlay Mobile. All rights reserved.</p>
      </footer>
    </div>
  );
}
