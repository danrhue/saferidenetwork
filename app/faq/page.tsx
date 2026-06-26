import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Legal & Platform FAQ | Safe Ride Network',
  description:
    'Frequently asked questions about Safe Ride Network accounts, data, GPS tracking, independent contractors, and platform policies.',
};

export default function FaqPage() {
  return (
    <LegalPageLayout
      title="Legal & Platform FAQ"
      subtitle="Common questions about accounts, data, safety, payments, and platform policies."
      lastUpdated="June 18, 2026"
    >
      <p>
        This FAQ addresses common legal, account, data, and platform usage questions about{' '}
        <strong>Safe Ride Network</strong>, a transportation marketplace operated by{' '}
        <strong>Shining Light Capital LLC</strong>. This FAQ is for informational purposes only and does not
        replace our <a href="/terms-of-service">Terms of Service</a> or{' '}
        <a href="/privacy-policy">Privacy Policy</a>.
      </p>

      <h2>About Safe Ride Network</h2>

      <div className="faq-item">
        <h3>What is Safe Ride Network?</h3>
        <p>
          Safe Ride Network is a professional transportation marketplace that connects{' '}
          <strong>Organizations</strong> (schools, districts, medical providers, clinics, senior living
          facilities, and similar entities) with <strong>independent contractor Drivers</strong> who provide
          transportation services.
        </p>
      </div>

      <div className="faq-item">
        <h3>Is Safe Ride Network a transportation company?</h3>
        <p>
          No. Shining Light Capital LLC operates the Platform technology. Safe Ride Network is a{' '}
          <strong>marketplace and coordination platform</strong>, not a motor carrier or employer of Drivers.
          Transportation services are arranged between Organizations and Drivers through the Platform.
        </p>
      </div>

      <div className="faq-item">
        <h3>Who operates Safe Ride Network?</h3>
        <p>Safe Ride Network is a product of <strong>Shining Light Capital LLC</strong>, a U.S.-based company.</p>
      </div>

      <h2>Organizations vs. Drivers</h2>

      <div className="faq-item">
        <h3>What is an &ldquo;Organization&rdquo; on the Platform?</h3>
        <p>
          An Organization is a business or institutional account that posts trips, reviews offers, assigns
          Drivers, and uses operational tools such as GPS tracking and trip history.
        </p>
      </div>

      <div className="faq-item">
        <h3>What is a &ldquo;Driver&rdquo; on the Platform?</h3>
        <p>
          A Driver is an <strong>independent contractor</strong> who browses posted trips, submits offers, and
          provides transportation services when selected by an Organization.
        </p>
      </div>

      <div className="faq-item">
        <h3>Are Drivers employees of Safe Ride Network?</h3>
        <p>
          No. Drivers are <strong>independent contractors</strong>, not employees, agents, or partners of
          Shining Light Capital LLC.
        </p>
      </div>

      <h2>Accounts &amp; Access</h2>

      <div className="faq-item">
        <h3>Who can create an account?</h3>
        <p>
          Authorized Organization representatives and Drivers who meet eligibility, licensing, insurance, and
          vetting requirements. The Platform is not intended for direct account creation by children under 13.
        </p>
      </div>

      <div className="faq-item">
        <h3>How do I reset my password or recover my account?</h3>
        <p>
          Use the Platform&apos;s password reset tools or contact{' '}
          <a href="mailto:dispatch@saferidenetwork.com">dispatch@saferidenetwork.com</a> from the email address
          associated with your account.
        </p>
      </div>

      <div className="faq-item">
        <h3>Why was my account suspended or terminated?</h3>
        <p>
          Accounts may be suspended or terminated for policy violations, safety concerns, fraud risk, inaccurate
          credentials, misuse of location data, or other reasons described in our Terms of Service.
        </p>
      </div>

      <h2>Trips, Offers, and Marketplace Rules</h2>

      <div className="faq-item">
        <h3>How does trip posting and driver offers work?</h3>
        <p>
          Organizations post trips with details and requirements. Vetted Drivers browse eligible trips and submit
          offers. Organizations review offers and assign a Driver. Trip execution is supported by GPS,
          geofencing, checklists, trip trails, and ratings.
        </p>
      </div>

      <div className="faq-item">
        <h3>Does Safe Ride Network guarantee a Driver will be available?</h3>
        <p>No. We do not guarantee offers, acceptance, availability, or completion times.</p>
      </div>

      <div className="faq-item">
        <h3>What types of transportation can be posted?</h3>
        <p>
          Examples include student transportation, non-emergency medical transport (NEMT), senior/accessibility
          rides, medical courier/logistics, and general/group transport. Trips must comply with law and Platform
          policies.
        </p>
      </div>

      <div className="faq-item">
        <h3>Is emergency ambulance transport supported?</h3>
        <p>
          No unless expressly authorized and legally permitted. Safe Ride Network is designed for professional
          non-emergency and organizational transportation coordination, not 911 emergency response.
        </p>
      </div>

      <h2>Safety, Vetting, and GPS Tracking</h2>

      <div className="faq-item">
        <h3>What vetting does Safe Ride Network perform for Drivers?</h3>
        <p>
          Driver onboarding may include background checks, drug screening (where applicable), vehicle inspections,
          and verification of credentials such as CPR/First Aid and Defensive Driving. Vetting reduces risk but
          does not guarantee safety or performance.
        </p>
      </div>

      <div className="faq-item">
        <h3>Why does the Platform collect GPS and location data?</h3>
        <p>
          Real-time GPS, geofencing alerts, and trip trails are core accountability features for Organizations
          managing student, medical, senior, and other sensitive transport needs.
        </p>
      </div>

      <div className="faq-item">
        <h3>Who can see GPS and trip location data?</h3>
        <p>
          Access is role-based and trip-specific. Authorized Organization users and operational parties involved
          in an active or historical trip may access relevant tracking and trip trail data through secure portals,
          subject to Platform permissions and policies.
        </p>
      </div>

      <h2>Payments &amp; Fees</h2>

      <div className="faq-item">
        <h3>How do payments work?</h3>
        <p>
          Depending on configuration, Organizations may pay through Platform checkout (for example, via Stripe).
          Drivers may receive payouts through supported payout systems (for example, Stripe Connect).
        </p>
      </div>

      <div className="faq-item">
        <h3>Does Safe Ride Network store my credit card number?</h3>
        <p>
          Payment card data is typically collected and processed by third-party payment processors under their
          own security standards and privacy policies.
        </p>
      </div>

      <h2>Privacy &amp; Data</h2>

      <div className="faq-item">
        <h3>What personal information does Safe Ride Network collect?</h3>
        <p>
          We collect account information, Organization and Driver profile details, trip details,
          credentials/documents, ratings/reviews, payment/payout records, and operational data including{' '}
          <strong>GPS/location data</strong> and trip history. See our{' '}
          <a href="/privacy-policy">Privacy Policy</a> for details.
        </p>
      </div>

      <div className="faq-item">
        <h3>Does Safe Ride Network sell personal information?</h3>
        <p>We do not sell personal information for money. See our Privacy Policy for how information is shared.</p>
      </div>

      <div className="faq-item">
        <h3>Can I request access to or deletion of my data?</h3>
        <p>
          You may submit a privacy request to{' '}
          <a href="mailto:dispatch@saferidenetwork.com">dispatch@saferidenetwork.com</a>. We may retain certain
          records where required by law or for safety, fraud prevention, dispute resolution, and trip
          accountability.
        </p>
      </div>

      <div className="faq-item">
        <h3>How is student or patient information handled?</h3>
        <p>
          Organizations often submit trip information related to students, patients, or other passengers.
          Organizations are responsible for lawful collection and required notices. Safe Ride Network processes
          this information to provide transportation coordination features.
        </p>
      </div>

      <h2>Schools, Healthcare, and Compliance</h2>

      <div className="faq-item">
        <h3>Can school districts use Safe Ride Network for student transportation?</h3>
        <p>
          Yes, the Platform is designed for organizational transportation needs including student routes, field
          trips, special needs transport, and related services, subject to Terms, policies, and applicable laws.
        </p>
      </div>

      <div className="faq-item">
        <h3>Does Safe Ride Network provide HIPAA compliance for medical providers?</h3>
        <p>
          The Platform includes security and accountability features useful to healthcare operations, but HIPAA
          compliance depends on how the Organization uses the Platform and whether a Business Associate Agreement
          (BAA) is in place. Contact us if your organization requires a BAA.
        </p>
      </div>

      <div className="faq-item">
        <h3>Who is responsible for regulatory compliance?</h3>
        <p>
          Organizations and Drivers are responsible for compliance with laws applicable to their services and
          sectors. Shining Light Capital does not provide legal or regulatory advice.
        </p>
      </div>

      <h2>Liability &amp; Legal Notices</h2>

      <div className="faq-item">
        <h3>Who is responsible if a trip is delayed, canceled, or disputed?</h3>
        <p>
          Transportation performance disputes are primarily between the Organization and Driver. Platform tools
          help with visibility and records, but Shining Light Capital does not guarantee outcomes.
        </p>
      </div>

      <div className="faq-item">
        <h3>Where are legal disputes handled?</h3>
        <p>
          Our <a href="/terms-of-service">Terms of Service</a> specify governing law and venue (State of Kansas,
          subject to attorney review).
        </p>
      </div>

      <h2>Copyright &amp; Intellectual Property</h2>

      <div className="faq-item">
        <h3>Can I use the Safe Ride Network logo in marketing materials?</h3>
        <p>
          Not without written permission, except as allowed by explicit authorization. See our{' '}
          <a href="/copyright">Copyright Notice</a>.
        </p>
      </div>

      <div className="faq-item">
        <h3>How do I report copyright infringement on the Platform?</h3>
        <p>
          Send a DMCA notice to{' '}
          <a href="mailto:dispatch@saferidenetwork.com">dispatch@saferidenetwork.com</a> with the details listed
          in our Copyright Notice.
        </p>
      </div>

      <h2>Contact &amp; Updates</h2>

      <div className="faq-item">
        <h3>How do I contact Safe Ride Network for legal or privacy questions?</h3>
        <p>
          Email: <a href="mailto:dispatch@saferidenetwork.com">dispatch@saferidenetwork.com</a>
          <br />
          Website: <a href="https://www.saferidenetwork.com">https://www.saferidenetwork.com</a>
        </p>
      </div>

      <div className="faq-item">
        <h3>How will I be notified of policy changes?</h3>
        <p>
          We may update Terms, Privacy Policy, and related notices by posting revised versions on the Platform
          and updating the &ldquo;Last Updated&rdquo; date. Material changes may also be communicated through the
          Platform or email where appropriate.
        </p>
      </div>
    </LegalPageLayout>
  );
}