import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Copyright Notice | Safe Ride Network',
  description: 'Copyright and intellectual property notice for Safe Ride Network, a product of Shining Light Capital LLC.',
};

export default function CopyrightPage() {
  return (
    <LegalPageLayout
      title="Copyright Notice"
      subtitle="Intellectual property, permitted use, and DMCA information for Safe Ride Network."
      effectiveDate="June 18, 2026"
    >
      <h2>Ownership</h2>
      <p>
        The <strong>Safe Ride Network</strong> website, platform software, user interfaces, branding, logos,
        design elements, text, graphics, documentation, and other content made available through{' '}
        <a href="https://www.saferidenetwork.com">saferidenetwork.com</a> (collectively, the
        &ldquo;Content&rdquo;) are owned by <strong>Shining Light Capital LLC</strong> or its licensors and
        are protected by United States and international copyright, trademark, and other intellectual property
        laws.
      </p>
      <p>
        <strong>Safe Ride Network</strong> is a product of <strong>Shining Light Capital LLC</strong>. Unless
        otherwise stated, all rights are reserved.
      </p>

      <h2>Permitted Use</h2>
      <p>
        You may access and use the Content only as necessary for lawful use of the Safe Ride Network Platform
        in accordance with our <a href="/terms-of-service">Terms of Service</a>.
      </p>
      <p>Without prior written permission from Shining Light Capital LLC, you may not:</p>
      <ul>
        <li>Copy, reproduce, distribute, publish, or commercially exploit Content</li>
        <li>Modify, adapt, translate, or create derivative works from Content</li>
        <li>Reverse engineer, decompile, or attempt to extract source code (except as permitted by law)</li>
        <li>Remove copyright, trademark, or proprietary notices</li>
        <li>Use Safe Ride Network trademarks or logos in a way that suggests endorsement or affiliation</li>
      </ul>

      <h2>Trademarks</h2>
      <p>
        &ldquo;Safe Ride Network,&rdquo; the Safe Ride Network logo, and related names, marks, and trade dress
        are trademarks or service marks of Shining Light Capital LLC (or affiliates/licensors). Other names and
        marks may be the property of their respective owners. No license to use any trademark is granted by
        implication or otherwise without written authorization.
      </p>

      <h2>User-Generated and Third-Party Content</h2>
      <p>
        The Platform may display content submitted by Organizations, Drivers, or third parties (for example,
        profile information, reviews, documents, or trip details). That content remains the responsibility of
        the submitting party. Third-party names, logos, and materials may be protected by their owners&apos;
        intellectual property rights.
      </p>

      <h2>Copyright Infringement Claims (DMCA)</h2>
      <p>
        If you believe content on the Platform infringes your copyright, you may submit a notice under the
        Digital Millennium Copyright Act (&ldquo;DMCA&rdquo;) to our designated agent:
      </p>
      <p>
        <strong>DMCA Agent</strong>
        <br />
        Shining Light Capital LLC (Safe Ride Network)
        <br />
        Email: <a href="mailto:dispatch@saferidenetwork.com">dispatch@saferidenetwork.com</a>
        <br />
        Subject line: <strong>DMCA Notice</strong>
      </p>
      <p>Your notice should include:</p>
      <ol>
        <li>Identification of the copyrighted work claimed to have been infringed</li>
        <li>Identification of the material claimed to be infringing and information reasonably sufficient to locate it on the Platform</li>
        <li>Your contact information (name, address, phone, email)</li>
        <li>A statement that you have a good-faith belief the use is not authorized by the copyright owner, agent, or law</li>
        <li>A statement, under penalty of perjury, that the information is accurate and you are authorized to act on behalf of the copyright owner</li>
        <li>Your physical or electronic signature</li>
      </ol>
      <p>
        We may remove or disable access to allegedly infringing material and may terminate repeat infringers
        where appropriate. If you believe material was removed in error, you may submit a DMCA counter-notification
        with the information required by 17 U.S.C. § 512(g).
      </p>

      <h2>Permissions and Licensing Requests</h2>
      <p>
        For permissions to use Content, trademarks, or media assets, contact{' '}
        <a href="mailto:dispatch@saferidenetwork.com">dispatch@saferidenetwork.com</a>.
      </p>

      <h2>Updates</h2>
      <p>We may update this Copyright Notice by posting a revised version on the Platform.</p>
    </LegalPageLayout>
  );
}