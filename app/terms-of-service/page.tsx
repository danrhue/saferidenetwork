import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Terms of Service | Safe Ride Network',
  description:
    'Terms and conditions for using Safe Ride Network, a transportation marketplace operated by Shining Light Capital LLC.',
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="Terms and conditions for Organizations, Drivers, and users of the Safe Ride Network marketplace."
      effectiveDate="June 18, 2026"
      lastUpdated="June 18, 2026"
      showLegalNotice
    >
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of{' '}
        <strong>Safe Ride Network</strong>, operated by <strong>Shining Light Capital LLC</strong>{' '}
        (&ldquo;Shining Light Capital,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
        including our website, applications, portals, and related services (the &ldquo;Platform&rdquo;).
        By using the Platform, you agree to these Terms.
      </p>

      <h2>1. What Safe Ride Network Is (and Is Not)</h2>
      <p>
        Safe Ride Network is a <strong>technology marketplace and coordination platform</strong> that helps
        Organizations post transportation needs and independent contractor Drivers browse trips, submit offers,
        and perform services when selected.
      </p>
      <p>
        <strong>Shining Light Capital does not provide transportation services</strong> and is not a motor
        carrier, common carrier, taxi service, ambulance provider, or employer of Drivers. The Platform provides
        tools such as trip posting, offer workflows, secure portals, real-time GPS tracking, geofencing alerts,
        trip history, pre-trip checklists, and ratings/reviews.
      </p>

      <h2>2. Eligibility and Account Types</h2>
      <p>
        You must be at least <strong>18 years old</strong> to create a Driver account or an authorized
        Organization user account. Organization accounts may only be used by authorized representatives who
        have authority to bind the Organization. You are responsible for maintaining account security.
      </p>

      <h2>3. Independent Contractor Relationship (Drivers)</h2>
      <p>
        Drivers are <strong>independent contractors</strong>, not employees, agents, or partners of Shining
        Light Capital. Drivers are solely responsible for their schedule, vehicle, expenses, licenses, insurance,
        taxes, and legal compliance. Shining Light Capital does not guarantee trip volume, earnings, or minimum
        income.
      </p>

      <h2>4. Marketplace Rules</h2>
      <ul>
        <li>Organizations may post trips including student transport, NEMT, senior/accessibility rides, medical courier, and group transport.</li>
        <li>Drivers may browse eligible trips and submit offers for Organization review and approval.</li>
        <li>We do not guarantee offers, acceptance, availability, or completion of any trip.</li>
        <li>Additional terms may apply between Organizations and Drivers outside the Platform.</li>
      </ul>

      <h2>5. Safety, Vetting, and Operational Tools</h2>
      <p>
        The Platform supports driver vetting (background checks, drug screening where applicable, vehicle
        inspections, CPR/First Aid, Defensive Driving), real-time GPS, geofencing, trip trails, pre-trip
        checklists, and ratings. These tools support transparency but <strong>do not guarantee safety</strong>{' '}
        or eliminate all transportation risks. Organizations remain responsible for selecting Drivers appropriate
        for their needs.
      </p>

      <h2>6. Payments, Fees, and Payouts</h2>
      <p>
        We may charge Platform fees disclosed during signup, trip posting, checkout, or payout setup. Payments
        and payouts may be processed by third parties (for example, Stripe). You agree to applicable processor
        terms. We may withhold or adjust payouts to address fraud, disputes, or policy violations.
      </p>

      <h2>7. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Violate applicable laws or regulations</li>
        <li>Misrepresent identity, credentials, vehicle capacity, or insurance</li>
        <li>Use the Platform for unauthorized emergency ambulance services</li>
        <li>Circumvent fees, vetting, ratings, or offer workflows</li>
        <li>Harass, threaten, or discriminate against users</li>
        <li>Misuse GPS, trip data, or portal access</li>
        <li>Interfere with Platform security or integrity</li>
      </ul>

      <h2>8. Organization Responsibilities</h2>
      <p>Organizations are responsible for:</p>
      <ul>
        <li>Accurate trip postings and safety/accessibility requirements</li>
        <li>Compliance with sector-specific laws (education, healthcare, NEMT, privacy)</li>
        <li>Required consents and notices for passenger data</li>
        <li>Operational decisions including Driver selection and trip approval</li>
      </ul>

      <h2>9. Driver Responsibilities</h2>
      <p>Drivers are responsible for:</p>
      <ul>
        <li>Valid licenses, permits, insurance, and vehicle safety</li>
        <li>Accurate vehicle and accessibility profile information</li>
        <li>Compliance with traffic laws and safety standards</li>
        <li>Completing required checklists and tracking workflows for active trips</li>
        <li>Professional, lawful conduct and prompt incident reporting</li>
      </ul>

      <h2>10. Ratings, Reviews, and Enforcement</h2>
      <p>
        We may use ratings, reviews, complaints, and operational records to investigate concerns and restrict
        access to the Platform. We are not obligated to publish or remove any particular review but may moderate
        unlawful, fraudulent, or abusive content.
      </p>

      <h2>11. Intellectual Property</h2>
      <p>
        The Platform and Shining Light Capital content are protected by intellectual property laws. You receive
        a limited, revocable license to use the Platform for its intended purpose. You may not copy, modify,
        reverse engineer, or resell the Platform except as permitted by law.
      </p>

      <h2>12. Third-Party Services</h2>
      <p>
        Mapping, payments, background checks, hosting, and other integrated services are governed by third-party
        terms. Shining Light Capital is not responsible for third-party services outside our reasonable control.
      </p>

      <h2>13. Disclaimers</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
        AVAILABLE.&rdquo; WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR
        A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT UNINTERRUPTED SERVICE, GPS ACCURACY AT ALL
        TIMES, OR THAT VETTING WILL IDENTIFY ALL RISKS.
      </p>

      <h2>14. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, SHINING LIGHT CAPITAL WILL NOT BE LIABLE FOR INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR LOST PROFITS, LOST DATA, BUSINESS
        INTERRUPTION, OR PERSONAL INJURY/PROPERTY DAMAGE ARISING FROM THE PLATFORM OR TRANSPORTATION SERVICES.
        OUR TOTAL LIABILITY FOR ANY CLAIM WILL NOT EXCEED THE GREATER OF (A) AMOUNTS PAID BY YOU TO US IN THE 12
        MONTHS BEFORE THE CLAIM, OR (B) $100.
      </p>

      <h2>15. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold harmless Shining Light Capital from claims arising out of your
        use of the Platform, transportation services you provide or arrange, your violation of these Terms or
        law, information you submit, and disputes between Organizations and Drivers.
      </p>

      <h2>16. Suspension and Termination</h2>
      <p>
        We may suspend or terminate access for policy violations, safety concerns, or risk to other users. Certain
        obligations survive termination, including payment, indemnity, intellectual property, and liability limitations.
      </p>

      <h2>17. Governing Law and Venue</h2>
      <p>
        These Terms are governed by the laws of the <strong>State of Kansas</strong>, without regard to conflict-of-law
        rules. Except where prohibited by law, exclusive jurisdiction and venue for disputes will be in state or
        federal courts located in Kansas.
      </p>

      <h2>18. Changes to These Terms</h2>
      <p>
        We may modify these Terms by posting updated versions on the Platform. Continued use after the effective
        date constitutes acceptance of material changes where permitted by law.
      </p>

      <h2>19. Contact</h2>
      <p>
        <strong>Shining Light Capital LLC</strong>
        <br />
        Safe Ride Network
        <br />
        Email: <a href="mailto:dispatch@saferidenetwork.com">dispatch@saferidenetwork.com</a>
      </p>
    </LegalPageLayout>
  );
}