import Link from 'next/link';
import OrganizationLogo from '@/app/components/OrganizationLogo';
import type { DriverAssignedTrip } from '@/lib/driver/driver-trip-lists';
import { getTripStatusBadgeClass } from '@/lib/driver/driver-trip-lists';

type ActiveTripCardProps = {
  trip: DriverAssignedTrip;
};

export default function ActiveTripCard({ trip }: ActiveTripCardProps) {
  return (
    <div className="rounded-2xl border-2 border-[#1E3A8A] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <OrganizationLogo photoPath={trip.organization_photo_url} size={40} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                Organization
              </p>
              <p className="font-semibold text-blue-950">
                {trip.organization_name || 'Organization'}
              </p>
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-900">{trip.title}</h3>
          <p className="text-gray-700">
            <span className="font-medium text-green-700">Pickup</span> {trip.pickup_location}
            <span className="mx-2 text-[#1E3A8A]">→</span>
            <span className="font-medium text-red-600">Dropoff</span> {trip.dropoff_location}
          </p>
          <p className="text-sm text-gray-600">
            {new Date(trip.pickup_time).toLocaleString()} • {trip.passengers || 1} passenger
            {(trip.passengers || 1) !== 1 ? 's' : ''}
          </p>
          {trip.description && (
            <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-gray-600">
              {trip.description}
            </p>
          )}
        </div>

        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <span
            className={`inline-flex self-start rounded-full border px-3 py-1 text-xs font-semibold md:self-end ${getTripStatusBadgeClass(trip.status)}`}
          >
            {trip.status === 'assigned' ? 'Assigned — Ready to Start' : 'In Progress'}
          </span>
          <Link
            href={`/dashboard/trip/${trip.id}`}
            className="inline-flex items-center justify-center rounded-xl bg-[#1E3A8A] px-8 py-3.5 font-semibold text-white shadow-sm transition hover:bg-blue-900"
          >
            Open Trip &amp; Navigation →
          </Link>
        </div>
      </div>
    </div>
  );
}