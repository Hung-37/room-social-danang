import { redirect } from 'next/navigation';

export default function RegisterPage() {
  // Redirect to home and trigger login modal in register mode
  redirect('/?openRegister=true');
}