import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy | Safe Ride Network',
  description:
    'How Safe Ride Network and Shining Light Capital LLC collect, use, and protect information including GPS, trip history, and driver credentials.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How we collect, use, and protect information on our transportation marketplace platform."
      effectiveDate="June 18, 2026"
      lastUpdated="June 18, 2026"
      showLegalNotice
    >
      <p>
        This Privacy Policy describes how <strong>Shining Light Capital LLC</strong> (&ldquo;Shining
        Light Capital,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects,
        uses, discloses, and protects information when you access or use <strong>Safe Ride Network</strong>{' '}
        (the &ldquo;Platform&rdquo;), including our website at{' '}
        <a href="https://www.saferidenetwork.com">saferidenetwork.com</a> and related services.
      </p>
      <p>
        Safe Ride Network is a <strong>professional transportation marketplace</strong> that connects{' '}
        <strong>Organizations</strong> (such as schools, school districts, medical providers, clinics,
        and senior living facilities) with <strong>independent contractor Drivers</strong>. We are not a
        transportation carrier. By using the Platform, you agree to this Privacy Policy.
      </p>

      <h2>1. Who This Policy Applies To</h2>
      <p>This Privacy Policy applies to:</p>
      <ul>
        <li>Organizations and their authorized users</li>
        <li>Drivers (independent contractors)</li>
        <li>Website visitors</li>
        <li>
          Other individuals whose information is submitted through the Platform (for example, passengers
          listed on trips)
        </li>
      </ul>

      <h2>2. Information We Collect</h2>
      <h3>A. Information You Provide</h3>
      <p>
        <strong>Account and profile information:</strong> Name, email, phone number, credentials, Organization
        name, facility type, role, and account preferences.
      </p>
      <p>
        <strong>Driver vetting and compliance information:</strong> Background check and screening results
        (where applicable), drug screening information, vehicle details, inspection records, certifications
        (CPR/First Aid, Defensive Driving), and uploaded verification documents.
      </p>
      <p>
        <strong>Organization and trip information:</strong> Trip postings (locations, dates, routes,
        passenger counts, special requirements), service categories (student transport, NEMT, senior/accessibility
        rides, medical courier, group transport), offer details, communications, ratings, and reviews.
      </p>
      <p>
        <strong>Payment and payout information:</strong> Billing details for Organizations and payout details
        for Drivers (for example, via Stripe Connect). Payment card data is generally processed by third-party
        payment processors, not stored directly by us.
      </p>

      <h3>B. Information Collected Automatically</h3>
      <p>
        <strong>Location and GPS data:</strong> Because the Platform provides real-time operational visibility,
        we collect precise location data including real-time GPS during active trips, geofencing events,
        historical trip trails, and location associated with trip status updates.
      </p>
      <p>
        <strong>Device, usage, and log data:</strong> IP address, browser type, device identifiers, pages
        viewed, features used, timestamps, and security logs.
      </p>
      <p>
        <strong>Cookies and similar technologies:</strong> Used for authentication, security, preferences,
        analytics, and Platform functionality.
      </p>

      <h3>C. Information from Third Parties</h3>
      <p>We may receive information from background screening providers, payment processors, mapping/GPS services, authentication and hosting providers, and Organizations or Drivers who submit trip-related information.</p>

      <h2>3. How We Use Information</h2>
      <p>We use information to:</p>
      <ul>
        <li>Operate the marketplace (trip posting, offers, assignments, and coordination)</li>
        <li>Provide safety and accountability features (GPS tracking, geofencing, trip trails, checklists, ratings)</li>
        <li>Verify users, enforce standards, and investigate fraud or policy violations</li>
        <li>Process payments and payouts</li>
        <li>Communicate with you about service, security, and account matters</li>
        <li>Improve, secure, and comply with legal obligations</li>
      </ul>

      <h2>4. How We Share Information</h2>
      <h3>Between Organizations and Drivers</h3>
      <p>
        To enable the marketplace, we share relevant trip details, profile information, offer terms, real-time
        trip status, GPS/location data, geofencing alerts, and trip history between parties involved in a trip,
        subject to Platform permissions.
      </p>
      <h3>Service Providers</h3>
      <p>
        We use vendors for hosting, payments, mapping/GPS, background screening, communications, analytics,
        and security. They access information only as needed to perform services for us.
      </p>
      <h3>Legal, Safety, and Compliance</h3>
      <p>We may disclose information to comply with law, enforce our Terms, protect safety, or investigate fraud and security incidents.</p>
      <h3>Business Transfers</h3>
      <p>Information may transfer in connection with a merger, acquisition, financing, or sale of assets.</p>
      <p>We do <strong>not</strong> sell personal information for money.</p>

      <h2>5. Student, Patient, and Passenger Data</h2>
      <p>
        Organizations may submit trip information relating to students, patients, seniors, or other passengers.
        Organizations are responsible for having a lawful basis to collect and share this information and for
        providing required notices. If you are seeking information about a specific trip, contact the Organization
        that arranged the transportation.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain information as long as reasonably necessary to provide the Platform, maintain trip and GPS
        history for accountability, comply with legal requirements, and resolve disputes. Trip and location history
        may be retained longer where needed for safety, compliance, or legal defense.
      </p>

      <h2>7. Security</h2>
      <p>
        We use administrative, technical, and organizational safeguards including role-based access controls and
        secure portals. No method of transmission or storage is completely secure. You are responsible for
        safeguarding your account credentials.
      </p>

      <h2>8. Your Choices and Rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, or receive a copy of certain
        personal information, and to opt out of marketing communications. Submit requests to{' '}
        <a href="mailto:dispatch@saferidenetwork.com">dispatch@saferidenetwork.com</a>. We may need to verify
        your identity and role before responding.
      </p>
      <p>
        California and certain other U.S. state residents may have additional privacy rights. We will honor
        applicable legal requirements.
      </p>

      <h2>9. Cookies</h2>
      <p>
        You can control cookies through browser settings. Disabling cookies may affect Platform functionality.
      </p>

      <h2>10. Children&apos;s Privacy</h2>
      <p>
        The Platform is not directed to children under 13 for direct account creation. Organizations may use
        the Platform to coordinate student transportation in compliance with applicable laws.
      </p>

      <h2>11. International Users</h2>
      <p>
        Safe Ride Network is operated from the United States. Information may be processed in the U.S. and other
        locations where our service providers operate.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy by posting a revised version on the Platform and updating the
        &ldquo;Last Updated&rdquo; date. Material changes may be communicated through the Platform or other
        appropriate means.
      </p>

      <h2>13. Contact Us</h2>
      <p>
        <strong>Shining Light Capital LLC</strong>
        <br />
        Safe Ride Network
        <br />
        Email: <a href="mailto:dispatch@saferidenetwork.com">dispatch@saferidenetwork.com</a>
        <br />
        Website: <a href="https://www.saferidenetwork.com">https://www.saferidenetwork.com</a>
      </p>
    </LegalPageLayout>
  );
}