import { Redirect } from 'expo-router';

export default function TripsIndex() {
  // This route just exists to handle the /trips path
  // The actual trips list is in app/trips.tsx
  return <Redirect href="/trips" />;
}
