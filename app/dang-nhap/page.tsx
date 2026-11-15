import { redirect } from 'next/navigation';

export default function LoginPage() {
  // Redirect to home and trigger login modal
  redirect('/?openLogin=true');
}